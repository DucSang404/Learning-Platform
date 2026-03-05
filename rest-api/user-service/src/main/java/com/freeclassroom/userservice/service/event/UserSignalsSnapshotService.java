package com.freeclassroom.userservice.service.event;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class UserSignalsSnapshotService {

    private final StringRedisTemplate redis;

    public String courseScoreKey(String subjectPrefix, String subjectId) {
        return subjectPrefix + subjectId + ":course_score";
    }

    public String tagScoreKey(String subjectPrefix, String subjectId) {
        return subjectPrefix + subjectId + ":tag_score";
    }

    public String lastActionKey(String subjectPrefix, String subjectId) {
        return subjectPrefix + subjectId + ":last_action";
    }

    /**
     * Build a normalized document for Elasticsearch: one doc per subject (user or guest).
     * subjectType: USER/GUEST
     */
    public Map<String, Object> buildSignalsDocument(String subjectType, String subjectId, String subjectPrefix) {
        long nowMs = System.currentTimeMillis();

        // courseScore
        Set<ZSetOperations.TypedTuple<String>> courseTuples = redis.opsForZSet()
                .reverseRangeWithScores(courseScoreKey(subjectPrefix, subjectId), 0, 49);
        List<Map<String, Object>> courseScore = new ArrayList<>();
        if (courseTuples != null) {
            for (var t : courseTuples) {
                if (t == null || t.getValue() == null || t.getScore() == null) continue;
                courseScore.add(Map.of(
                        "courseId", t.getValue(),
                        "score", t.getScore()
                ));
            }
        }

        // tagScore
        Set<ZSetOperations.TypedTuple<String>> tagTuples = redis.opsForZSet()
                .reverseRangeWithScores(tagScoreKey(subjectPrefix, subjectId), 0, 49);
        List<Map<String, Object>> tagScore = new ArrayList<>();
        if (tagTuples != null) {
            for (var t : tagTuples) {
                if (t == null || t.getValue() == null || t.getScore() == null) continue;
                tagScore.add(Map.of(
                        "tag", t.getValue(),
                        "score", t.getScore()
                ));
            }
        }

        // lastAction
        Map<Object, Object> last = redis.opsForHash().entries(lastActionKey(subjectPrefix, subjectId));
        Map<String, Object> lastAction = new HashMap<>();
        if (last != null && !last.isEmpty()) {
            putLong(lastAction, "lastSeenAtMs", last.get("last_seen_at_ms"));
            putString(lastAction, "lastEventName", last.get("last_event_name"));
            putString(lastAction, "lastCourseId", last.get("last_course_id"));
            putString(lastAction, "lastTag", last.get("last_tag"));
        }

        Map<String, Object> doc = new HashMap<>();
        doc.put("subjectType", subjectType);
        doc.put("subjectId", subjectId);
        doc.put("updatedAt", nowMs);
        doc.put("courseScore", courseScore);
        doc.put("tagScore", tagScore);
        doc.put("lastAction", lastAction);
        return doc;
    }

    private static void putString(Map<String, Object> m, String key, Object v) {
        if (v == null) return;
        String s = v.toString();
        if (s.isBlank()) return;
        m.put(key, s);
    }

    private static void putLong(Map<String, Object> m, String key, Object v) {
        if (v == null) return;
        try {
            m.put(key, Long.parseLong(v.toString()));
        } catch (Exception ignored) {
        }
    }
}

