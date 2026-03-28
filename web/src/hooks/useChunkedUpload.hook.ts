/**
 * Hook for managing chunked video upload lifecycle
 * Handles: initialization, chunking, presign requests, S3 uploads, and SSE completion
 */

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import chunkedUploadService from '@/services/course/chunked-upload.service'
import {
  splitFileIntoChunks,
  batchPartNumbers,
  calculateProgress,
  FileChunk
} from '@/utils/upload/file-chunking.util'
import { InitUploadRequest, CompleteUploadResponse } from '@/types/chunked-upload.type'

const ERROR_CODES = {
  SESSION_NOT_FOUND: 'LESSON_UPLOAD_SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'LESSON_UPLOAD_SESSION_EXPIRED',
  INVALID_PART: 'LESSON_UPLOAD_INVALID_PART',
  INVALID_STATE: 'LESSON_UPLOAD_INVALID_STATE',
  TOO_MANY_PARTS: 'LESSON_UPLOAD_TOO_MANY_PARTS'
}

const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.SESSION_NOT_FOUND]: 'Session không được tìm thấy. Vui lòng bắt đầu upload mới.',
  [ERROR_CODES.SESSION_EXPIRED]:
    'Phiên upload đã hết hạn. Vui lòng bắt đầu upload mới.',
  [ERROR_CODES.INVALID_PART]: 'Một số chunks bị lỗi. Vui lòng upload lại.',
  [ERROR_CODES.INVALID_STATE]: 'Trạng thái upload không hợp lệ. Vui lòng làm mới.',
  [ERROR_CODES.TOO_MANY_PARTS]:
    'File quá lớn với kích thước chunk này. Vui lòng tăng kích thước chunk.'
}

/**
 * Extract error code and message from API response or error
 */
function extractErrorMessage(error: any): string {
  // Check API error response
  if (error?.response?.data?.code) {
    const code = error.response.data.code
    return ERROR_MESSAGES[code] || error.response.data.message || 'Upload thất bại'
  }

  // Check error message
  if (error?.message) {
    // Check if error message contains known error code
    for (const [code, msg] of Object.entries(ERROR_MESSAGES)) {
      if (error.message.includes(code)) {
        return msg
      }
    }
    return error.message
  }

  return 'Có lỗi xảy ra. Vui lòng thử lại.'
}

export interface UseChunkedUploadState {
  sessionId: string | null
  fileName: string | null
  totalSize: number
  uploadedSize: number
  progress: number
  isUploading: boolean
  isCompleting: boolean
  error: string | null
  lesson: CompleteUploadResponse | null
  chunks: FileChunk[]
  uploadedEtags: Map<number, string> // part number -> etag
}

const initialState: UseChunkedUploadState = {
  sessionId: null,
  fileName: null,
  totalSize: 0,
  uploadedSize: 0,
  progress: 0,
  isUploading: false,
  isCompleting: false,
  error: null,
  lesson: null,
  chunks: [],
  uploadedEtags: new Map()
}

export function useChunkedUpload() {
  const [state, setState] = useState<UseChunkedUploadState>(initialState)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Initialize upload: split file, init session, prepare chunks
   */
  const startUpload = useCallback(
    async (file: File, initRequest: Omit<InitUploadRequest, 'fileSize' | 'fileName' | 'contentType'>) => {
      try {
        setState((prev) => ({
          ...prev,
          isUploading: true,
          error: null
        }))

        // Step 1: Split file into chunks
        const chunkingResult = await splitFileIntoChunks(file, initRequest.chunkSize)

        setState((prev) => ({
          ...prev,
          fileName: file.name,
          totalSize: file.size,
          chunks: chunkingResult.chunks
        }))

        const initResponse = await chunkedUploadService.initUpload({
          ...initRequest,
          fileSize: file.size,
          fileName: file.name,
          contentType: file.type,
          chunkSize: chunkingResult.chunkSize
        })

        if (!initResponse.result) {
          throw new Error(initResponse.message || 'Failed to initialize upload')
        }

        const sessionData = initResponse.result!
        setState((prev) => ({
          ...prev,
          sessionId: sessionData.sessionId
        }))

        return { sessionId: sessionData.sessionId, chunks: chunkingResult.chunks }
      } catch (error) {
        const errorMsg = extractErrorMessage(error)
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isUploading: false
        }))
        toast.error(errorMsg)
        throw error
      }
    },
    []
  )

  /**
   * Upload all chunks with presigned URLs
   * Returns the Map of part numbers to ETags for use in completeUpload
   */
  const uploadChunks = useCallback(
    async (sessionId: string, chunks: FileChunk[]): Promise<Map<number, string>> => {
      if (!sessionId || chunks.length === 0) {
        throw new Error('Invalid session or no chunks to upload')
      }

      try {
        abortControllerRef.current = new AbortController()
        const etags = new Map<number, string>()
        let uploadedSize = 0

        // Batch presign requests (max 1000 per request)
        const partNumbers = chunks.map((c) => c.partNumber)
        const batches = batchPartNumbers(partNumbers, 1000)

        // Upload chunks in batches
        for (const batch of batches) {
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Upload cancelled')
          }

          // Get presigned URLs for this batch
          const presignResponse = await chunkedUploadService.getPresignedUrls(sessionId, batch)

          if (!presignResponse.result) {
            throw new Error(presignResponse.message || 'Failed to get presigned URLs')
          }

          // Upload chunks in parallel (but with concurrency limit to avoid overwhelming network)
          const presignedParts = presignResponse.result!.parts
          const concurrency = 3

          for (let i = 0; i < presignedParts.length; i += concurrency) {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Upload cancelled')
            }

            const batchToUpload = presignedParts.slice(i, i + concurrency)
            const uploadPromises = batchToUpload.map(async (presignedPart) => {
              const chunk = chunks.find((c) => c.partNumber === presignedPart.partNumber)
              if (!chunk) return

              // Check if presigned URL is about to expire
              if (chunkedUploadService.isPresignedUrlExpiringSoon(presignedPart.expiresAt)) {
                throw new Error(`Presigned URL expired for part ${presignedPart.partNumber}`)
              }

              // Upload chunk with retry
              const etag = await chunkedUploadService.uploadChunkWithRetry(
                presignedPart.url,
                chunk.data,
                3
              )

              etags.set(chunk.partNumber, etag)
              uploadedSize += chunk.size

              // Update progress
              setState((prev) => ({
                ...prev,
                uploadedSize,
                progress: calculateProgress(uploadedSize, prev.totalSize)
              }))
            })

            await Promise.all(uploadPromises)
          }
        }

        setState((prev) => ({
          ...prev,
          uploadedEtags: etags,
          uploadedSize: prev.totalSize, // Ensure progress is 100%
          progress: 100
        }))

        // Return etags for immediate use in completeUpload
        return etags
      } catch (error) {
        const errorMsg = extractErrorMessage(error)
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isUploading: false
        }))
        toast.error(errorMsg)
        throw error
      }
    },
    []
  )

  /**
   * Complete upload via SSE stream
   * Accepts uploadedEtags as parameter to avoid race conditions with state closure
   */
  const completeUpload = useCallback(
    async (
      sessionId: string,
      uploadedEtags: Map<number, string>,
      title?: string,
      content?: string,
      duration?: number
    ) => {
      if (!sessionId || uploadedEtags.size === 0) {
        throw new Error('Invalid session or no chunks uploaded')
      }

      try {
        setState((prev) => ({
          ...prev,
          isCompleting: true
        }))

        // Prepare parts in ascending order
        const parts = Array.from(uploadedEtags.entries())
          .sort(([a], [b]) => a - b)
          .map(([partNumber, etag]) => ({
            partNumber,
            etag // etag is already quoted from S3
          }))

        // Complete upload with SSE
        const response = await chunkedUploadService.completeUpload(
          sessionId,
          { parts, title, content, duration },
          (event) => {
            if (event.type === 'saving_db') {
              toast.loading('Đang lưu thông tin bài giảng...')
            } else if (event.type === 'completed') {
              toast.success('Bài giảng đã tải lên thành công!')
            }
          }
        )

        setState((prev) => ({
          ...prev,
          isCompleting: false,
          isUploading: false,
          lesson: response
        }))

        return response
      } catch (error) {
        const errorMsg = extractErrorMessage(error)
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isCompleting: false,
          isUploading: false
        }))
        toast.error(errorMsg)
        throw error
      }
    },
    []
  )

  /**
   * Abort the entire upload
   */
  const abort = useCallback(async (sessionId: string) => {
    try {
      abortControllerRef.current?.abort()

      if (sessionId) {
        await chunkedUploadService.abortUpload(sessionId)
      }

      setState(initialState)
      toast.info('Upload cancelled')
    } catch (error) {
      const errorMsg = extractErrorMessage(error)
      toast.error(errorMsg)
    }
  }, [])

  /**
   * Resume an upload by checking session status
   */
  const resumeSession = useCallback(async (sessionId: string) => {
    try {
      const response = await chunkedUploadService.getSession(sessionId)

      if (!response.result) {
        throw new Error(response.message || 'Session not found')
      }

      const session = response.result!

      if (session.status === 'EXPIRED' || session.status === 'ABORTED') {
        throw new Error(`Session is ${session.status}. Please start a new upload.`)
      }

      setState((prev) => ({
        ...prev,
        sessionId,
        totalSize: session.totalParts * session.chunkSize // Approximate
      }))

      return session
    } catch (error) {
      const errorMsg = extractErrorMessage(error)
      toast.error(errorMsg)
      throw error
    }
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState(initialState)
    abortControllerRef.current?.abort()
  }, [])

  return {
    // State
    ...state,

    // Actions
    startUpload,
    uploadChunks,
    completeUpload,
    abort,
    resumeSession,
    reset
  }
}
