package com.freeclassroom.userservice.service.recommendation;

import com.freeclassroom.userservice.dto.request.auth.Identity;
import com.freeclassroom.userservice.dto.response.ApiResponse;
import com.freeclassroom.userservice.dto.response.recommendation.RecommendedCourseItem;
import com.freeclassroom.userservice.dto.response.recommendation.RecommendedCoursePageResponse;
import com.freeclassroom.userservice.infrastructure.elasticsearch.CourseIndexService;
import com.freeclassroom.userservice.infrastructure.elasticsearch.TrackingEventIndexService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CourseRecommendationService {

    TrackingEventIndexService trackingEventIndexService;
    CourseIndexService courseIndexService;

    private static final int MAX_SIZE = 50;

    // candidate pool multiplier so we have room to rank after mixing sources
    private static final int CANDIDATE_MULTIPLIER = 8;

    // scoring weights (normalized 0..1 components)
    // NOTE: weights should sum to ~1.0 for predictability.
    private static final double W_COURSE_SCORE = 0.35;
    private static final double W_TAG_MATCH = 0.35;
    private static final double W_SIMILARITY = 0.20;
    private static final double W_RECENCY = 0.05;
    private static final double W_POPULARITY = 0.05;

    // We want a stable ranking across different `size` values.
    // Always rank from a sufficiently large pool.
    private static final int MIN_CANDIDATES = 300;

    // Ensure a minimum portion of candidates come from tagScore-driven retrieval.
    private static final int MIN_TAG_CANDIDATES = 120;

    private boolean isUser(Identity identity) {
        return identity != null && "USER".equals(identity.getType()) && identity.getId() != null && !identity.getId().isBlank();
    }

    private boolean isGuest(Identity identity) {
        return identity != null && "GUEST".equals(identity.getType()) && identity.getId() != null && !identity.getId().isBlank();
    }

    public ApiResponse<RecommendedCoursePageResponse> getTopCoursesForUser(Identity identity,
                                                                           String courseId,
                                                                           String tag,
                                                                           Integer page,
                                                                           Integer size) {
        int pageSize = normalizeSize(size);
        int pageNumber = normalizePage(page);
        int offset = Math.multiplyExact(pageNumber, pageSize);

        String userId = identity.getId();
        boolean isUser = isUser(identity);
        boolean isGuest = isGuest(identity);
        String subjectType = isUser ? "USER" : (isGuest ? "GUEST" : null);

        Map<String, Object> source = trackingEventIndexService.getSignalsSource(subjectType, userId);

        // IMPORTANT:
        // Build a stable ranked list independent from requested page size.
        // We rank from a candidate pool sized on the requested pageSize, then do limit-based pagination.
        int desiredTotal = pageSize * (pageNumber + 1);
        List<RecommendedCourseItem> all = buildRankedRecommendations(source, courseId, tag, desiredTotal, pageSize);

        int from = Math.min(offset, all.size());
        int to = Math.min(from + pageSize, all.size());
        List<RecommendedCourseItem> items = all.subList(from, to);

        return ApiResponse.<RecommendedCoursePageResponse>builder()
                .code(200)
                .result(RecommendedCoursePageResponse.builder()
                        .items(items)
                        .nextCursor(null)
                        .build())
                .build();
    }

    private int normalizeSize(Integer size) {
        int s = (size == null) ? 20 : size;
        if (s < 1) s = 1;
        if (s > MAX_SIZE) s = MAX_SIZE;
        return s;
    }

    private int normalizePage(Integer page) {
        int p = (page == null) ? 0 : page;
        return Math.max(0, p);
    }

    private static String normalizeTag(String raw) {
        if (raw == null) return null;
        String t = raw.trim().toLowerCase();
        return t.isBlank() ? null : t;
    }

    private static String trimTag(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isBlank() ? null : t;
    }

    private List<RecommendedCourseItem> buildRankedRecommendations(Map<String, Object> source,
                                                                   String preferredCourseId,
                                                                   String preferredTag,
                                                                   int desiredTotal,
                                                                   int requestSize) {
        desiredTotal = Math.min(Math.max(desiredTotal, 0), 500);
        if (desiredTotal == 0) return List.of();

        Map<String, Double> courseScore = extractCourseScore(source);
        Map<String, Double> tagScoreNormalizedKeys = extractTagScore(source);
        Map<String, Double> tagScoreRawKeys = extractTagScoreRaw(source);

        String lastCourseId = extractLastCourseId(source);
        Instant lastSeenAt = extractLastSeenAt(source);

        List<String> courseScoreIds = courseScore.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(200)
                .map(Map.Entry::getKey)
                .filter(Objects::nonNull)
                .toList();

        List<String> tagScoreTagsRaw = buildTopTagsForSearch(tagScoreRawKeys, trimTag(preferredTag));

        List<String> lastCourseTags = fetchTagsForCourseId(lastCourseId);
        List<String> lastCourseTagsNormalized = lastCourseTags.stream()
                .map(CourseRecommendationService::normalizeTag)
                .filter(Objects::nonNull)
                .toList();

        // Key fix:
        // Candidate pool size must be largely independent from requestSize to avoid missing high-score items
        // when `size` is small.
        int base = Math.max(requestSize, 10);
        int candidateSize = Math.min(500, Math.max(MIN_CANDIDATES, base * CANDIDATE_MULTIPLIER));

        // Exclude the currently-viewed course (if client passes courseId) so we don't recommend it back.
        List<String> excludeIds = new ArrayList<>();
        if (preferredCourseId != null && !preferredCourseId.isBlank()) excludeIds.add(preferredCourseId);

        List<Map<String, Object>> candidateHits = courseIndexService.searchCandidateCourses(
                // Ensure we always include courseScore candidates in the ES pool so they get proper scoring
                // (otherwise they might be missing tags and end up with a weak computed score).
                courseScoreIds,
                tagScoreTagsRaw,
                lastCourseTags,
                candidateSize,
                excludeIds,
                true
        );

        // Guarantee enough tag-driven candidates even if match_all fills the pool.
        if (!tagScoreTagsRaw.isEmpty()) {
            int tagMatchesInPool = countTagMatches(candidateHits, tagScoreNormalizedKeys);
            int minRequired = Math.min(MIN_TAG_CANDIDATES, candidateSize / 2);
            if (tagMatchesInPool < minRequired) {
                int extraSize = Math.min(400, candidateSize);
                List<Map<String, Object>> extraTag = courseIndexService.searchCandidateCourses(
                        List.of(),
                        tagScoreTagsRaw,
                        List.of(),
                        extraSize,
                        excludeIds,
                        false
                );
                if (!extraTag.isEmpty()) {
                    candidateHits = mergeCandidateHits(candidateHits, extraTag, candidateSize);
                }
            }
        }

        double maxPossibleTagMatch = computeMaxPossibleTagMatch(tagScoreNormalizedKeys);
        double recencyBase = computeRecencyScore(lastSeenAt, Instant.now());

        double maxCourseScore = computeMaxCourseScore(courseScore);

        Map<String, RecommendedCourseItem> byCourseId = new HashMap<>();

        // Seed with explicit courseScore ids (in case ES returns none).
        for (String csId : courseScoreIds) {
            if (csId == null || csId.isBlank()) continue;
            double popularityScore = 0.5;
            double score = computeFinalScore(
                    List.of(),
                    csId,
                    courseScore,
                    tagScoreNormalizedKeys,
                    maxPossibleTagMatch,
                    maxCourseScore,
                    lastCourseTagsNormalized,
                    recencyBase,
                    popularityScore
            );
            byCourseId.putIfAbsent(csId, RecommendedCourseItem.builder()
                    .courseId(csId)
                    .score(score)
                    .reason("courseScore")
                    .build());
        }

        for (Map<String, Object> h : candidateHits) {
            String cId = extractCourseIdFromCourseDoc(h);
            if (cId == null || cId.isBlank()) continue;

            List<String> tags = toStringList(h.get("tags"));
            String reason = deriveReason(cId, tags, courseScore, tagScoreNormalizedKeys, lastCourseTags);

            double popularityScore = 0.5;
            double score = computeFinalScore(
                    tags,
                    cId,
                    courseScore,
                    tagScoreNormalizedKeys,
                    maxPossibleTagMatch,
                    maxCourseScore,
                    lastCourseTagsNormalized,
                    recencyBase,
                    popularityScore
            );

            RecommendedCourseItem existing = byCourseId.get(cId);
            if (existing == null || score > existing.getScore()) {
                byCourseId.put(cId, RecommendedCourseItem.builder()
                        .courseId(cId)
                        .score(score)
                        .reason(reason)
                        .build());
            }
        }

        List<RecommendedCourseItem> ranked = new ArrayList<>(byCourseId.values());
        ranked.sort((a, b) -> {
            int cmp = Double.compare(b.getScore(), a.getScore());
            if (cmp != 0) return cmp;
            return a.getCourseId().compareTo(b.getCourseId());
        });

        if (ranked.size() > desiredTotal) {
            ranked = ranked.subList(0, desiredTotal);
        }

        return ranked;
    }

    private static int countTagMatches(List<Map<String, Object>> candidates, Map<String, Double> tagScore) {
        if (candidates == null || candidates.isEmpty()) return 0;
        if (tagScore == null || tagScore.isEmpty()) return 0;

        int count = 0;
        for (Map<String, Object> h : candidates) {
            List<String> tags = toStringList(h.get("tags"));
            if (computeTagMatchSum(tags, tagScore) > 0) count++;
        }
        return count;
    }

    /**
     * finalScore = w_courseScore * courseScore + w_tagMatch * tagMatch + w_similarity * similarity
     *            + w_recency * recency + w_popularity * popularity
     * where each component is normalized to 0..1.
     */
    private static double computeFinalScore(List<String> courseTags,
                                           String courseId,
                                           Map<String, Double> courseScore,
                                           Map<String, Double> tagScore,
                                           double maxPossibleTagMatch,
                                           double maxCourseScore,
                                           List<String> lastCourseTagsNormalized,
                                           double recencyScore,
                                           double popularityScore) {
        double rawCourseScore = (courseScore == null || courseId == null) ? 0d : courseScore.getOrDefault(courseId, 0d);
        double courseScoreNormalized = normalize01(rawCourseScore, maxCourseScore);

        double tagMatchSum = computeTagMatchSum(courseTags, tagScore);
        double tagMatchNormalized = normalize01(tagMatchSum, maxPossibleTagMatch);

        double similarity = computeJaccardSimilarity(courseTags, lastCourseTagsNormalized);

        double recency = clamp01(recencyScore);
        double popularity = clamp01(popularityScore);

        double base = (W_COURSE_SCORE * courseScoreNormalized)
                + (W_TAG_MATCH * tagMatchNormalized)
                + (W_SIMILARITY * similarity)
                + (W_RECENCY * recency)
                + (W_POPULARITY * popularity);

        return base;
    }

    private static double computeMaxCourseScore(Map<String, Double> courseScore) {
        if (courseScore == null || courseScore.isEmpty()) return 1d;
        return courseScore.values().stream()
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .max()
                .orElse(1d);
    }

    /** Sum tagScore for tags present in the course. */
    private static double computeTagMatchSum(List<String> courseTags, Map<String, Double> tagScore) {
        if (tagScore == null || tagScore.isEmpty()) return 0d;
        if (courseTags == null || courseTags.isEmpty()) return 0d;

        double sum = 0d;
        for (String tRaw : courseTags) {
            String t = normalizeTag(tRaw);
            if (t == null) continue;
            sum += tagScore.getOrDefault(t, 0d);
        }
        return sum;
    }

    /**
     * Normalize tagMatchScore. A pragmatic max bound is sum of top N tag scores.
     * Keeps tagMatch in 0..1 and avoids domination.
     */
    private static double computeMaxPossibleTagMatch(Map<String, Double> tagScore) {
        if (tagScore == null || tagScore.isEmpty()) return 1d;

        return tagScore.values().stream()
                .sorted(Comparator.reverseOrder())
                .limit(10)
                .mapToDouble(Double::doubleValue)
                .sum();
    }

    /** Similarity between candidate tags and last course tags (0..1). */
    private static double computeJaccardSimilarity(List<String> courseTags, List<String> lastCourseTagsNormalized) {
        if (courseTags == null || courseTags.isEmpty()) return 0d;
        if (lastCourseTagsNormalized == null || lastCourseTagsNormalized.isEmpty()) return 0d;

        Set<String> a = new HashSet<>();
        for (String t : courseTags) {
            String n = normalizeTag(t);
            if (n != null) a.add(n);
        }
        if (a.isEmpty()) return 0d;

        Set<String> b = new HashSet<>(lastCourseTagsNormalized);

        int intersection = 0;
        for (String x : a) {
            if (b.contains(x)) intersection++;
        }

        int union = a.size() + b.size() - intersection;
        if (union <= 0) return 0d;

        return clamp01((double) intersection / (double) union);
    }

    /**
     * Convert lastSeenAt to recency score.
     * <1 day: 1.0
     * <7 days: 0.8
     * <30 days: 0.5
     * >=30 days: 0.2
     */
    private static double computeRecencyScore(Instant lastSeenAt, Instant now) {
        if (lastSeenAt == null || now == null) return 0.3; // neutral-ish default

        long days = Math.max(0, Duration.between(lastSeenAt, now).toDays());

        if (days < 1) return 1.0;
        if (days < 7) return 0.8;
        if (days < 30) return 0.5;
        return 0.2;
    }

    private static double normalize01(double value, double max) {
        if (max <= 0) return 0d;
        return clamp01(value / max);
    }

    private static double clamp01(double v) {
        if (Double.isNaN(v) || Double.isInfinite(v)) return 0d;
        if (v < 0d) return 0d;
        if (v > 1d) return 1d;
        return v;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Double> extractCourseScore(Map<String, Object> source) {
        if (source == null) return Map.of();

        Map<String, Double> courseScore = new HashMap<>();
        Object csObj = source.get("courseScore");
        if (csObj instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;

                String id = firstString(m.get("courseId"));
                Double sc = firstDouble(m.get("score"));
                if (id == null || sc == null) continue;
                courseScore.put(id, sc);
            }
        }
        return courseScore;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Double> extractTagScore(Map<String, Object> source) {
        if (source == null) return Map.of();

        Map<String, Double> tagScore = new HashMap<>();
        Object tsObj = source.get("tagScore");
        if (tsObj instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;

                String tag = normalizeTag(firstString(m.get("tag")));
                Double sc = firstDouble(m.get("score"));
                if (tag == null || sc == null) continue;
                tagScore.put(tag, sc);
            }
        }
        return tagScore;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Double> extractTagScoreRaw(Map<String, Object> source) {
        if (source == null) return Map.of();

        Map<String, Double> tagScore = new HashMap<>();
        Object tsObj = source.get("tagScore");
        if (tsObj instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;

                String tag = trimTag(firstString(m.get("tag")));
                Double sc = firstDouble(m.get("score"));
                if (tag == null || sc == null) continue;
                tagScore.put(tag, sc);
            }
        }
        return tagScore;
    }

    @SuppressWarnings("unchecked")
    private static String extractLastCourseId(Map<String, Object> source) {
        if (source == null) return null;

        Object v = source.get("lastAction.lastCourseId");
        if (v != null) {
            String s = firstString(v);
            if (s != null && !s.isBlank()) return s;
        }

        Object lastAction = source.get("lastAction");
        if (lastAction instanceof Map<?, ?> m) {
            String s = firstString(m.get("lastCourseId"));
            if (s != null && !s.isBlank()) return s;
        }

        return null;
    }

    @SuppressWarnings("unchecked")
    private static Instant extractLastSeenAt(Map<String, Object> source) {
        if (source == null) return null;

        Object v = source.get("lastAction.lastSeenAtMs");
        if (v == null) {
            Object lastAction = source.get("lastAction");
            if (lastAction instanceof Map<?, ?> m) {
                v = m.get("lastSeenAtMs");
            }
        }

        if (v == null) return null;

        String raw = firstString(v);
        if (raw == null || raw.isBlank()) return null;

        try {
            return Instant.parse(raw);
        } catch (Exception ignored) {
        }

        try {
            long epochMs = Long.parseLong(raw);
            return Instant.ofEpochMilli(epochMs);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<String> fetchTagsForCourseId(String courseId) {
        if (courseId == null || courseId.isBlank()) return List.of();

        // Query ES by id to retrieve tags of the last course.
        List<Map<String, Object>> hits = courseIndexService.searchCandidateCourses(
                List.of(courseId),
                List.of(),
                List.of(),
                1,
                List.of(),
                false
        );

        if (hits.isEmpty()) return List.of();
        return toStringList(hits.getFirst().get("tags"));
    }

    private static List<String> buildTopTagsForSearch(Map<String, Double> tagScore, String preferredTag) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (preferredTag != null) out.add(preferredTag);

        tagScore.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(20)
                .forEach(e -> {
                    if (e.getKey() != null && !e.getKey().isBlank()) out.add(e.getKey());
                });

        return new ArrayList<>(out);
    }

    private static String extractCourseIdFromCourseDoc(Map<String, Object> courseSource) {
        if (courseSource == null) return null;
        String courseId = firstString(courseSource.get("courseId"));
        if (courseId != null && !courseId.isBlank()) return courseId;

        return firstString(courseSource.get("id"));
    }

    private static String firstString(Object v) {
        if (v == null) return null;
        if (v instanceof String s) return s;

        if (v instanceof List<?> list && !list.isEmpty() && list.getFirst() != null) {
            return list.getFirst().toString();
        }
        return v.toString();
    }

    private static Double firstDouble(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof List<?> list && !list.isEmpty() && list.getFirst() != null) {
            try {
                return Double.parseDouble(list.getFirst().toString());
            } catch (Exception ignored) {
                return null;
            }
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception ignored) {
            return null;
        }
    }

    private static List<String> toStringList(Object v) {
        if (v == null) return List.of();
        if (v instanceof List<?> list) {
            List<String> out = new ArrayList<>();
            for (Object o : list) {
                if (o == null) continue;
                out.add(o.toString());
            }
            return out;
        }
        if (v instanceof String s) return List.of(s);
        return List.of();
    }

    private static List<Map<String, Object>> mergeCandidateHits(List<Map<String, Object>> a,
                                                               List<Map<String, Object>> b,
                                                               int limit) {
        if (limit <= 0) return List.of();

        LinkedHashMap<String, Map<String, Object>> dedup = new LinkedHashMap<>();
        if (a != null) {
            for (Map<String, Object> h : a) {
                String id = extractCourseIdFromCourseDoc(h);
                if (id != null) dedup.putIfAbsent(id, h);
                if (dedup.size() >= limit) return new ArrayList<>(dedup.values());
            }
        }

        if (b != null) {
            for (Map<String, Object> h : b) {
                String id = extractCourseIdFromCourseDoc(h);
                if (id != null) dedup.putIfAbsent(id, h);
                if (dedup.size() >= limit) break;
            }
        }

        return new ArrayList<>(dedup.values());
    }

    private static String deriveReason(String courseId,
                                      List<String> tags,
                                      Map<String, Double> courseScore,
                                      Map<String, Double> tagScore,
                                      List<String> lastCourseTags) {
        if (courseScore != null && courseScore.containsKey(courseId)) return "courseScore";

        double tagRel = computeTagMatchSum(tags, tagScore);
        if (tagRel > 0) return "tagScore";

        if (lastCourseTags != null && !lastCourseTags.isEmpty() && tags != null) {
            for (String t : tags) {
                if (t == null) continue;
                if (lastCourseTags.contains(t)) return "lastCourseTags";
            }
        }

        return "popular";
    }
}
