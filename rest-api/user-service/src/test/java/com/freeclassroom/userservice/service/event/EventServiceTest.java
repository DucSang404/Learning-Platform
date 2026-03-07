package com.freeclassroom.userservice.service.event;

import com.freeclassroom.userservice.dto.request.auth.Identity;
import com.freeclassroom.userservice.dto.request.personal.TrackingEventRequest;
import com.freeclassroom.userservice.grpc.client.CourseGrpcClient;
import com.freeclassroom.userservice.infrastructure.elasticsearch.TrackingEventIndexService;
import com.freeclassroom.userservice.service.event.UserSignalsSnapshotService;
import org.mockito.Mockito;
import org.springframework.data.redis.connection.DataType;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class EventServiceTest {

    private StringRedisTemplate redis;
    private CourseGrpcClient courseGrpcClient;
    private TrackingEventIndexService trackingEventIndexService;
    private UserSignalsSnapshotService snapshotService;
    private EventService eventService;

    @BeforeMethod
    void setup() {
        redis = Mockito.mock(StringRedisTemplate.class, RETURNS_DEEP_STUBS);
        courseGrpcClient = Mockito.mock(CourseGrpcClient.class, RETURNS_DEEP_STUBS);
        trackingEventIndexService = Mockito.mock(TrackingEventIndexService.class, RETURNS_DEEP_STUBS);
        snapshotService = Mockito.mock(UserSignalsSnapshotService.class, RETURNS_DEEP_STUBS);
        eventService = new EventService(redis, courseGrpcClient, trackingEventIndexService, snapshotService);
    }

    @Test
    void saveEventToRedis_guest_viewCourse_shouldUpdateZsetLastAction_andRefreshTTL() {
        Identity identity = new Identity();
        identity.setType("GUEST");
        identity.setId("guest-abc");

        TrackingEventRequest req = new TrackingEventRequest();
        req.setEventName("VIEW_COURSE");
        Map<String, String> payload = new HashMap<>();
        payload.put("courseId", "123");
        req.setPayload(payload);

        Mockito.when(snapshotService.courseScoreKey("guest:", "guest-abc")).thenReturn("guest:abc:course_score");
        Mockito.when(snapshotService.tagScoreKey("guest:", "guest-abc")).thenReturn("guest:abc:tag_score");
        Mockito.when(snapshotService.lastActionKey("guest:", "guest-abc")).thenReturn("guest:abc:last_action");

        eventService.saveEventToRedis(identity, req);

        verify(redis.opsForZSet()).incrementScore("guest:abc:course_score", "123", 1d);
        verify(redis.opsForHash()).putAll(eq("guest:abc:last_action"), anyMap());

        // TTL refreshed for guests (course_score + last_action)
        verify(redis, atLeastOnce()).expire(eq("guest:abc:course_score"), any());
        verify(redis, atLeastOnce()).expire(eq("guest:abc:last_action"), any());
    }

    @Test
    void mergeGuestEventsToUser_shouldMergeCourseScores_andDeleteGuestKeys() {
        Mockito.when(snapshotService.courseScoreKey("guest:", "guest-abc")).thenReturn("guest:abc:course_score");
        Mockito.when(snapshotService.tagScoreKey("guest:", "guest-abc")).thenReturn("guest:abc:tag_score");
        Mockito.when(snapshotService.lastActionKey("guest:", "guest-abc")).thenReturn("guest:abc:last_action");

        Mockito.when(snapshotService.courseScoreKey("user:", "u1")).thenReturn("user:u1:course_score");
        Mockito.when(snapshotService.tagScoreKey("user:", "u1")).thenReturn("user:u1:tag_score");
        Mockito.when(snapshotService.lastActionKey("user:", "u1")).thenReturn("user:u1:last_action");

        when(redis.type("guest:abc:course_score")).thenReturn(DataType.ZSET);

        ZSetOperations.TypedTuple<String> tuple = mock(ZSetOperations.TypedTuple.class);
        when(tuple.getValue()).thenReturn("1");
        when(tuple.getScore()).thenReturn(2d);
        when(redis.opsForZSet().rangeWithScores("guest:abc:course_score", 0, -1)).thenReturn(Set.of(tuple));

        // last_action absent
        when(redis.type("guest:abc:last_action")).thenReturn(DataType.NONE);
        when(redis.type("user:u1:last_action")).thenReturn(DataType.NONE);

        eventService.mergeGuestEventsToUser("guest-abc", "u1");

        verify(redis.opsForZSet()).incrementScore("user:u1:course_score", "1", 2d);
        verify(redis).delete("guest:abc:course_score");
        verify(redis).delete("guest:abc:tag_score");
        verify(redis).delete("guest:abc:last_action");
    }
}
