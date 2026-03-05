package com.freeclassroom.userservice.infrastructure.elasticsearch;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrackingEventIndexService {

    private final RestClient es;
    private final ElasticsearchProperties props;

    public String indexName() {
        return props.getIndex().getTrackingEvents();
    }

    public void ensureIndexExists() {
        String index = indexName();

        boolean exists;
        try {
            exists = es.head()
                    .uri("/{index}", index)
                    .retrieve()
                    .toBodilessEntity()
                    .getStatusCode()
                    .is2xxSuccessful();
        } catch (Exception e) {
            exists = false;
        }

        if (exists) return;

        Map<String, Object> body = Map.of(
                "mappings", Map.of(
                        "dynamic", "false",
                        "properties", Map.of(
                                "subjectType", Map.of("type", "keyword"),
                                "subjectId", Map.of("type", "keyword"),
                                "updatedAt", Map.of("type", "date", "format", "epoch_millis"),
                                "courseScore", Map.of(
                                        "type", "nested",
                                        "properties", Map.of(
                                                "courseId", Map.of("type", "keyword"),
                                                "score", Map.of("type", "double")
                                        )
                                ),
                                "tagScore", Map.of(
                                        "type", "nested",
                                        "properties", Map.of(
                                                "tag", Map.of("type", "keyword"),
                                                "score", Map.of("type", "double")
                                        )
                                ),
                                "lastAction", Map.of(
                                        "properties", Map.of(
                                                "lastSeenAtMs", Map.of("type", "date", "format", "epoch_millis"),
                                                "lastEventName", Map.of("type", "keyword"),
                                                "lastCourseId", Map.of("type", "keyword"),
                                                "lastTag", Map.of("type", "keyword")
                                        )
                                )
                        )
                )
        );

        es.put()
                .uri("/{index}", index)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public String documentId(String subjectType, String subjectId) {
        return subjectType + ":" + subjectId;
    }

    /** Upsert full signals snapshot (one doc per subject). */
    public void upsertSignals(String subjectType, String subjectId, Map<String, Object> doc) {
        es.put()
                .uri("/{index}/_doc/{id}", indexName(), documentId(subjectType, subjectId))
                .contentType(MediaType.APPLICATION_JSON)
                .body(doc)
                .retrieve()
                .toBodilessEntity();
    }

    /** Backward compatibility for user-only callers. */
    public void upsertUserSignals(String userId, Map<String, Object> doc) {
        upsertSignals("USER", userId, doc);
    }

    public void deleteSignals(String subjectType, String subjectId) {
        es.delete()
                .uri("/{index}/_doc/{id}", indexName(), documentId(subjectType, subjectId))
                .retrieve()
                .toBodilessEntity();
    }
}
