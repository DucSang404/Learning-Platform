package com.freeclassroom.courseservice.search;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.BulkResponse;
import com.freeclassroom.courseservice.entity.category.CategoryEntity;
import com.freeclassroom.courseservice.entity.course.CourseEntity;
import com.freeclassroom.courseservice.enums.entity.EnumCourseStatus;
import com.freeclassroom.courseservice.repository.entity.CourseRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CourseSearchMigrationServiceTest {

    @Test
    void migrate_shouldBulkIndexFullCourseDocuments() throws IOException {
        ElasticsearchClient es = mock(ElasticsearchClient.class, RETURNS_DEEP_STUBS);
        CourseRepository repo = mock(CourseRepository.class);

        // minimal service instance
        CourseSearchMigrationService service = new CourseSearchMigrationService(es, repo);

        // set private @Value fields via reflection (keep test minimal)
        TestField.set(service, "indexName", "courses");
        TestField.set(service, "batchSize", 500);
        TestField.set(service, "createIndexIfMissing", false);
        TestField.set(service, "recreateIndexOnStartup", false);

        LocalDateTime now = LocalDateTime.now();

        CourseEntity c1 = CourseEntity.builder()
                .id("c1")
                .title("Java")
                .shortDescription("short")
                .longDescription("long")
                .thumbnailUrl("thumb")
                .introductoryVideo("intro")
                .language("vi")
                .originalPrice(100.0)
                .finalPrice(80.0)
                .rating(4.5)
                .instructorId("u1")
                .category(CategoryEntity.builder().name("Programming").build())
                .status(EnumCourseStatus.PUBLISHED)
                .createdAt(now)
                .deleted(false)
                .build();

        BulkResponse bulkResponse = mock(BulkResponse.class);
        when(bulkResponse.errors()).thenReturn(false);
        when(es.bulk(any(BulkRequest.class))).thenReturn(bulkResponse);

        // invoke the internal bulk method via public API by stubbing repo paging to single page
        when(repo.findAllWithTags(any())).thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(c1)));

        service.migrateAllCoursesIdAndTags();

        ArgumentCaptor<BulkRequest> captor = ArgumentCaptor.forClass(BulkRequest.class);
        verify(es, times(1)).bulk(captor.capture());

        BulkRequest req = captor.getValue();
        assertNotNull(req);
        assertEquals(1, req.operations().size());

        var op = req.operations().get(0);
        assertNotNull(op.index());
        assertEquals("courses", op.index().index());
        assertEquals("c1", op.index().id());

        Object docObj = op.index().document();
        assertTrue(docObj instanceof CourseEsDocument, "Expected CourseEsDocument in bulk index operation");
        CourseEsDocument doc = (CourseEsDocument) docObj;

        assertEquals("c1", doc.getId());
        assertEquals("Java", doc.getTitle());
        assertEquals("short", doc.getShortDescription());
        assertEquals("long", doc.getLongDescription());
        assertEquals("thumb", doc.getThumbnailUrl());
        assertEquals("intro", doc.getIntroductoryVideo());
        assertEquals("vi", doc.getLanguage());
        assertEquals(100.0, doc.getOriginalPrice());
        assertEquals(80.0, doc.getFinalPrice());
        assertEquals(4.5, doc.getRating());
        assertEquals("u1", doc.getInstructorId());
        assertEquals("Programming", doc.getCategory());
        assertEquals(now, doc.getCreatedAt());
        assertEquals("PUBLISHED", doc.getStatus());
        assertEquals(false, doc.getDeleted());
    }
}
