package com.freeclassroom.userservice.service.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.freeclassroom.userservice.dto.request.auth.Identity;
import com.freeclassroom.userservice.dto.request.personal.TrackingEventRequest;
import com.freeclassroom.userservice.grpc.client.CourseGrpcClient;
import com.freeclassroom.userservice.infrastructure.elasticsearch.TrackingEventIndexService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.experimental.FieldDefaults;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

import static com.freeclassroom.userservice.enums.RedisStreamEnum.EVENT_USER;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class EventService implements IEventService {
    StringRedisTemplate redis;
    CourseGrpcClient courseGrpcClient;
    TrackingEventIndexService trackingEventIndexService;
    UserSignalsSnapshotService snapshotService;

    // RCM v2 tuning
    private static final int TOP_COURSE_KEEP = 50;
    private static final int TOP_TAG_KEEP = 50;

    private static final String EVENT_VIEW_COURSE = "VIEW_COURSE";

    private static final long GUEST_TTL_SECONDS = 60L * 60 * 24 * 30; // 30 days

    private String courseScoreKey(String userId) {
        return "user:" + userId + ":course_score";
    }

    private String tagScoreKey(String userId) {
        return "user:" + userId + ":tag_score";
    }

    private String lastActionKey(String userId) {
        return "user:" + userId + ":last_action";
    }

    private void trimZsetToTopN(String key, int keepTopN) {
        if (keepTopN <= 0) {
            redis.delete(key);
            return;
        }
        Long size = redis.opsForZSet().zCard(key);
        if (size == null) return;
        long excess = size - keepTopN;
        if (excess <= 0) return;
        redis.opsForZSet().removeRange(key, 0, excess - 1);
    }

    private boolean isUser(Identity identity) {
        return identity != null && "USER".equals(identity.getType()) && identity.getId() != null && !identity.getId().isBlank();
    }

    private boolean isGuest(Identity identity) {
        return identity != null && "GUEST".equals(identity.getType()) && identity.getId() != null && !identity.getId().isBlank();
    }

    private static String safeString(Object v) {
        return v == null ? "" : v.toString();
    }

    private static String normalizeTag(String raw) {
        if (raw == null) return "";
        return raw.trim().toLowerCase();
    }

    private String subjectPrefix(boolean isUser) {
        return isUser ? "user:" : "guest:";
    }

    private void applyGuestTtl(String key) {
        try {
            redis.expire(key, java.time.Duration.ofSeconds(GUEST_TTL_SECONDS));
        } catch (Exception ignored) {
        }
    }

    @Override
    public void persistEventToDatabase() {
        // Not implemented
    }

    @Override
    public RecordId saveEventToRedis(Identity identity, TrackingEventRequest trackingEvent) {
        if (identity == null || trackingEvent == null) return null;

        boolean isUser = isUser(identity);
        boolean isGuest = isGuest(identity);
        if (!isUser && !isGuest) return null;

        String subjectId = identity.getId();
        String prefix = subjectPrefix(isUser);

        String eventName = trackingEvent.getEventName();
        Map<String, String> payload = trackingEvent.getPayload();
        String courseId = payload == null ? null : payload.get("courseId");
        String tagFromClient = payload == null ? null : payload.get("tag");

        long nowMs = System.currentTimeMillis();

        if (EVENT_VIEW_COURSE.equals(eventName) && courseId != null && !courseId.isBlank()) {
            // course score
            String courseKey = snapshotService.courseScoreKey(prefix, subjectId);
            redis.opsForZSet().incrementScore(courseKey, courseId, 1d);
            trimZsetToTopN(courseKey, TOP_COURSE_KEEP);

            // tag score: from course-service
            if (courseGrpcClient != null) {
                try {
                    var res = courseGrpcClient.getCourseTags(courseId);
                    if (res != null && res.getTagsCount() > 0) {
                        String tagKey = snapshotService.tagScoreKey(prefix, subjectId);
                        for (String t : res.getTagsList()) {
                            String normalized = normalizeTag(t);
                            if (normalized.isBlank()) continue;
                            redis.opsForZSet().incrementScore(tagKey, normalized, 1d);
                        }
                        trimZsetToTopN(tagKey, TOP_TAG_KEEP);
                    }
                } catch (Exception ignored) {
                }
            }

            if (tagFromClient != null && !tagFromClient.isBlank()) {
                String tagKey = snapshotService.tagScoreKey(prefix, subjectId);
                redis.opsForZSet().incrementScore(tagKey, normalizeTag(tagFromClient), 1d);
                trimZsetToTopN(tagKey, TOP_TAG_KEEP);
            }

            // last action
            String lastKey = snapshotService.lastActionKey(prefix, subjectId);
            Map<String, String> lastActionUpdate = new HashMap<>();
            lastActionUpdate.put("last_seen_at_ms", String.valueOf(nowMs));
            lastActionUpdate.put("last_event_name", safeString(eventName));
            lastActionUpdate.put("last_course_id", courseId);
            if (tagFromClient != null && !tagFromClient.isBlank()) {
                lastActionUpdate.put("last_tag", normalizeTag(tagFromClient));
            }
            redis.opsForHash().putAll(lastKey, lastActionUpdate);

            // guest TTL
            if (isGuest) {
                applyGuestTtl(courseKey);
                applyGuestTtl(snapshotService.tagScoreKey(prefix, subjectId));
                applyGuestTtl(lastKey);
            }

            // upsert signals to ES
            try {
                trackingEventIndexService.ensureIndexExists();
                Map<String, Object> doc = snapshotService.buildSignalsDocument(isUser ? "USER" : "GUEST", subjectId, prefix);
                trackingEventIndexService.upsertSignals(isUser ? "USER" : "GUEST", subjectId, doc);
            } catch (Exception e) {
                log.debug("Upsert signals to ES failed", e);
            }
        }

        // raw event stream: keep both USER and GUEST
        String payloadJson = "";
        if (payload != null && !payload.isEmpty()) {
            try {
                payloadJson = new ObjectMapper().writeValueAsString(payload);
            } catch (JsonProcessingException ignored) {
                payloadJson = "";
            }
        }

        Map<String, String> fields = new HashMap<>();
        fields.put("userId", subjectId);
        fields.put("eventName", safeString(eventName));
        fields.put("payload", payloadJson);
        fields.put("createdAt", String.valueOf(nowMs));
        if (courseId != null) fields.put("courseId", courseId);
        if (tagFromClient != null) fields.put("tag", tagFromClient);

        // stream name
        String stream = isUser ? "event:user" : "event:guest";
        RecordId recordId = redis.opsForStream().add(stream, fields);
        redis.opsForStream().trim(stream, 10_000);
        if (isGuest) {
            // also TTL the stream key itself
            applyGuestTtl(stream);
        }
        return recordId;
    }

    @Override
    public void mergeGuestEventsToUser(String guestId, String userId) {
        if (guestId == null || guestId.isBlank() || userId == null || userId.isBlank()) return;

        String guestPrefix = "guest:";
        String userPrefix = "user:";

        // Merge course_score
        String guestCourseKey = snapshotService.courseScoreKey(guestPrefix, guestId);
        String userCourseKey = snapshotService.courseScoreKey(userPrefix, userId);
        var guestCourses = redis.opsForZSet().rangeWithScores(guestCourseKey, 0, -1);
        if (guestCourses != null) {
            for (var t : guestCourses) {
                if (t == null || t.getValue() == null || t.getScore() == null) continue;
                redis.opsForZSet().incrementScore(userCourseKey, t.getValue(), t.getScore());
            }
            trimZsetToTopN(userCourseKey, TOP_COURSE_KEEP);
        }

        // Merge tag_score
        String guestTagKey = snapshotService.tagScoreKey(guestPrefix, guestId);
        String userTagKey = snapshotService.tagScoreKey(userPrefix, userId);
        var guestTags = redis.opsForZSet().rangeWithScores(guestTagKey, 0, -1);
        if (guestTags != null) {
            for (var t : guestTags) {
                if (t == null || t.getValue() == null || t.getScore() == null) continue;
                redis.opsForZSet().incrementScore(userTagKey, t.getValue(), t.getScore());
            }
            trimZsetToTopN(userTagKey, TOP_TAG_KEEP);
        }

        // Merge last_action (prefer most recent)
        String guestLastKey = snapshotService.lastActionKey(guestPrefix, guestId);
        String userLastKey = snapshotService.lastActionKey(userPrefix, userId);
        Map<Object, Object> guestLast = redis.opsForHash().entries(guestLastKey);
        Map<Object, Object> userLast = redis.opsForHash().entries(userLastKey);

        Long guestSeen = toLong(guestLast.get("last_seen_at_ms"));
        Long userSeen = toLong(userLast.get("last_seen_at_ms"));
        boolean takeGuest = guestSeen != null && (userSeen == null || guestSeen > userSeen);
        if (takeGuest && !guestLast.isEmpty()) {
            Map<String, String> merged = new HashMap<>();
            for (var e : guestLast.entrySet()) {
                if (e.getKey() == null || e.getValue() == null) continue;
                merged.put(e.getKey().toString(), e.getValue().toString());
            }
            if (!merged.isEmpty()) {
                redis.opsForHash().putAll(userLastKey, merged);
            }
        }

        // Delete guest keys (history is merged)
        redis.delete(guestCourseKey);
        redis.delete(guestTagKey);
        redis.delete(guestLastKey);

        // Upsert merged USER signals to ES
        try {
            trackingEventIndexService.ensureIndexExists();
            Map<String, Object> userDoc = snapshotService.buildSignalsDocument("USER", userId, userPrefix);
            trackingEventIndexService.upsertSignals("USER", userId, userDoc);
        } catch (Exception e) {
            log.debug("Upsert merged user signals to ES failed", e);
        }

        // Delete guest doc in ES after merge (best-effort)
        try {
            trackingEventIndexService.deleteSignals("GUEST", guestId);
        } catch (Exception e) {
            // ignore 404s or ES downtime
            log.debug("Delete guest signals doc failed", e);
        }
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        try {
            return Long.parseLong(v.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
