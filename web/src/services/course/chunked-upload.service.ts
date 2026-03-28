/**
 * Chunked Upload Service
 * Handles all API calls for the new v2 chunked upload flow with presigned URLs
 */

import axiosClient from '@/lib/axiosClient.lib'
import axiosS3Client from '@/lib/axiosS3Client.lib'
import axiosAuthUtils from '@/utils/auth/axios.utils'
import { ApiResponse } from '@/types/response.type'
import {
  InitUploadRequest,
  InitUploadResponse,
  PresignResponse,
  SessionResponse,
  CompleteUploadRequest,
  CompleteUploadResponse
} from '@/types/chunked-upload.type'

// Re-export types for convenience
export type {
  InitUploadRequest,
  InitUploadResponse,
  PresignResponse,
  SessionResponse,
  CompleteUploadRequest,
  CompleteUploadResponse
}

// === Main Service ===

class ChunkedUploadService {
  private baseUrl = 'learning/lessons/video/v2'

  /**
   * Step 1: Initialize an upload session
   */
  async initUpload(request: InitUploadRequest): Promise<ApiResponse<InitUploadResponse>> {
    const response = await axiosClient.axiosInstance.post(`${this.baseUrl}/sessions`, request)
    return response.data
  }

  /**
   * Step 2: Get presigned URLs for uploading chunks
   */
  async getPresignedUrls(
    sessionId: string,
    partNumbers: number[]
  ): Promise<ApiResponse<PresignResponse>> {
    const response = await axiosClient.axiosInstance.post(
      `${this.baseUrl}/sessions/${sessionId}/presign`,
      { partNumbers }
    )
    return response.data
  }

  /**
   * Step 3: Upload a chunk directly to S3 using presigned URL
   * Returns ETag from S3 response header
   * NOTE: Do NOT include Authorization header - presigned URL has auth in query params
   */
  async uploadChunkToS3(presignedUrl: string, chunk: Blob): Promise<string> {
    const response = await axiosS3Client.axiosInstance.put(presignedUrl, chunk, {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    })

    // Extract ETag from response headers
    const etag = response.headers['etag'] || response.headers.etag
    if (!etag) {
      throw new Error('Failed to retrieve ETag from S3 response')
    }

    return etag
  }

  /**
   * Step 4: Complete the multipart upload (SSE stream)
   * Yields progress events: 'saving_db' and 'completed'
   */
  async completeUpload(
    sessionId: string,
    request: CompleteUploadRequest,
    onEvent?: (event: { type: string; data: any }) => void
  ): Promise<CompleteUploadResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get the authorization token
        const token = axiosAuthUtils.getAccessToken()
        const baseURL = axiosClient.axiosInstance.defaults.baseURL

        // Use fetch for SSE stream with proper headers
        const response = await fetch(`${baseURL}/${this.baseUrl}/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify(request),
          credentials: 'include'
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        if (!response.body) {
          throw new Error('No response body received')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let completedReceived = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Split by double newline to get complete SSE messages
          const messages = buffer.split('\n\n')
          
          // Keep the last incomplete message in buffer
          buffer = messages[messages.length - 1]

          // Process all complete messages
          for (let i = 0; i < messages.length - 1; i++) {
            const message = messages[i].trim()
            if (!message) continue

            const lines = message.split('\n')
            let eventType = ''
            let eventData = ''

            // Parse event and data lines
            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.substring('event:'.length).trim()
              } else if (line.startsWith('data:')) {
                eventData = line.substring('data:'.length).trim()
              }
            }

            // Emit event if we have both type and data
            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData)
                onEvent?.({ type: eventType, data })

                if (eventType === 'completed') {
                  completedReceived = true
                  resolve(data)
                  return
                }
              } catch (e) {
                // Silently ignore parse errors
              }
            }
          }
        }

        // Handle remaining buffer if stream ended
        if (buffer.trim()) {
          const lines = buffer.trim().split('\n')
          let eventType = ''
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring('event:'.length).trim()
            } else if (line.startsWith('data:')) {
              eventData = line.substring('data:'.length).trim()
            }
          }

          if (eventType && eventData) {
            try {
              const data = JSON.parse(eventData)
              onEvent?.({ type: eventType, data })

              if (eventType === 'completed') {
                completedReceived = true
                resolve(data)
                return
              }
            } catch (e) {
              // Silently ignore parse errors
            }
          }
        }

        if (!completedReceived) {
          reject(new Error('SSE stream ended without completed event'))
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Step 5: Get current session status (for resume)
   */
  async getSession(sessionId: string): Promise<ApiResponse<SessionResponse>> {
    const response = await axiosClient.axiosInstance.get(
      `${this.baseUrl}/sessions/${sessionId}`
    )
    return response.data
  }

  /**
   * Step 6: Abort an upload session
   */
  async abortUpload(sessionId: string): Promise<ApiResponse<void>> {
    const response = await axiosClient.axiosInstance.delete(
      `${this.baseUrl}/sessions/${sessionId}`
    )
    return response.data
  }

  /**
   * Convenience method to upload a chunk with retry logic
   */
  async uploadChunkWithRetry(
    presignedUrl: string,
    chunk: Blob,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.uploadChunkToS3(presignedUrl, chunk)
      } catch (error) {
        lastError = error as Error
        // Exponential backoff: 1s, 2s, 4s
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    throw lastError || new Error('Upload failed after retries')
  }

  /**
   * Check if a presigned URL is about to expire (within 30 seconds)
   */
  isPresignedUrlExpiringSoon(expiresAt: number, buffer: number = 30000): boolean {
    const timeUntilExpiry = expiresAt - Date.now()
    return timeUntilExpiry < buffer
  }
}

export default new ChunkedUploadService()
