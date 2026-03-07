package com.freeclassroom.userservice.service.recommendation;

import com.freeclassroom.userservice.dto.response.ApiResponse;
import com.freeclassroom.userservice.dto.response.recommendation.RecommendedCoursePageResponse;
import com.freeclassroom.userservice.infrastructure.elasticsearch.CourseIndexService;
import com.freeclassroom.userservice.infrastructure.elasticsearch.TrackingEventIndexService;
import org.mockito.Mockito;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static org.testng.Assert.*;

public class CourseRecommendationServiceTest {

    private TrackingEventIndexService trackingEventIndexService;
    private CourseIndexService courseIndexService;
    private CourseRecommendationService service;

    @BeforeMethod
    void setup() {
        trackingEventIndexService = Mockito.mock(TrackingEventIndexService.class, Mockito.RETURNS_DEEP_STUBS);
        courseIndexService = Mockito.mock(CourseIndexService.class, Mockito.RETURNS_DEEP_STUBS);
        service = new CourseRecommendationService(trackingEventIndexService, courseIndexService);
    }

    @Test
    void tagAndCourse_shouldPrioritizeThatCourseFirst() {
        Mockito.when(trackingEventIndexService.getSignalsSource("USER", "u1")).thenReturn(Map.of(
                "courseScore", List.of(Map.of("courseId", List.of("c1"), "score", List.of(1))),
                "tagScore", List.of(Map.of("tag", List.of("t1"), "score", List.of(1)))
        ));

        ApiResponse<RecommendedCoursePageResponse> res = service.getTopCoursesForUser("u1", "c1", "t1", 0, 10);
        assertNotNull(res);
        assertNotNull(res.getResult());
        assertTrue(res.getResult().getItems().size() >= 1);
        assertEquals(res.getResult().getItems().getFirst().getCourseId(), "c1");
        assertEquals(res.getResult().getItems().getFirst().getReason(), "tag+courseId");
    }

    @Test
    void courseOnly_shouldPrioritizeThatCourseFirst() {
        Mockito.when(trackingEventIndexService.getSignalsSource("USER", "u1")).thenReturn(Map.of(
                "courseScore", List.of(Map.of("courseId", "c2", "score", 5d))
        ));

        ApiResponse<RecommendedCoursePageResponse> res = service.getTopCoursesForUser("u1", "c1", null, 0, 10);
        assertEquals(res.getResult().getItems().getFirst().getCourseId(), "c1");
        assertEquals(res.getResult().getItems().getFirst().getReason(), "courseId");
    }

    @Test
    void shouldFillWithTagBasedCoursesWhenCourseScoreInsufficient() {
        Mockito.when(trackingEventIndexService.getSignalsSource("USER", "u1")).thenReturn(Map.of(
                "courseScore", List.of(Map.of("courseId", List.of("c1"), "score", List.of(1))),
                "tagScore", List.of(
                        Map.of("tag", List.of("Data Science"), "score", List.of(3)),
                        Map.of("tag", List.of("Select (Sql)"), "score", List.of(2))
                )
        ));

        Mockito.when(courseIndexService.searchCoursesByTags(Mockito.anyCollection(), Mockito.anyInt(), Mockito.anyCollection()))
                .thenReturn(List.of(
                        Map.of("courseId", "c2", "tags", List.of("Data Science")),
                        Map.of("courseId", "c3", "tags", List.of("Select (Sql)")),
                        Map.of("courseId", "c4", "tags", List.of("Other"))
                ));

        ApiResponse<RecommendedCoursePageResponse> res = service.getTopCoursesForUser("u1", null, null, 0, 3);
        assertEquals(res.getResult().getItems().size(), 3);
        assertEquals(res.getResult().getItems().get(0).getCourseId(), "c1");
        assertTrue(res.getResult().getItems().stream().anyMatch(i -> "c2".equals(i.getCourseId())));
        assertTrue(res.getResult().getItems().stream().anyMatch(i -> "c3".equals(i.getCourseId())));
    }
}
