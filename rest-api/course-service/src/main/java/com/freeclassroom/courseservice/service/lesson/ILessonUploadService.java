package com.freeclassroom.courseservice.service.lesson;

import com.freeclassroom.courseservice.dto.request.lesson.ChunkCompleteRequest;
import com.freeclassroom.courseservice.dto.request.lesson.ChunkPresignRequest;
import com.freeclassroom.courseservice.dto.request.lesson.ChunkedUploadInitRequest;
import com.freeclassroom.courseservice.dto.response.ApiResponse;
import com.freeclassroom.courseservice.dto.response.lesson.ChunkPresignResponse;
import com.freeclassroom.courseservice.dto.response.lesson.ChunkedUploadInitResponse;
import com.freeclassroom.courseservice.dto.response.lesson.LessonUploadSessionResponse;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;

public interface ILessonUploadService {
    ChunkedUploadInitResponse initUpload(ChunkedUploadInitRequest request, String instructorId);

    ChunkPresignResponse generatePresignedUrls(String sessionId, ChunkPresignRequest request, String instructorId);

    Flux<ServerSentEvent<String>> completeUpload(String sessionId, ChunkCompleteRequest request, String instructorId);

    ApiResponse<Void> abortUpload(String sessionId, String instructorId);

    LessonUploadSessionResponse getSession(String sessionId, String instructorId);
}

