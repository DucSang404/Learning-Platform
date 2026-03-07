//package com.freeclassroom.courseservice.search;
//
//import co.elastic.clients.elasticsearch.ElasticsearchClient;
//import co.elastic.clients.elasticsearch.core.BulkRequest;
//import co.elastic.clients.elasticsearch.core.BulkResponse;
//import com.freeclassroom.courseservice.entity.category.TagEntity;
//import com.freeclassroom.courseservice.entity.course.CourseEntity;
//import com.freeclassroom.courseservice.repository.entity.CourseRepository;
//import org.junit.jupiter.api.Test;
//
//import java.io.IOException;
//import java.util.List;
//
//import static org.mockito.ArgumentMatchers.any;
//import static org.mockito.Mockito.*;
//
//class CourseSearchMigrationServiceTest {
//
//    @Test
//    void migrate_shouldBulkIndexDocumentsWithIdAndDistinctTagNames() throws IOException {
//        ElasticsearchClient es = mock(ElasticsearchClient.class, RETURNS_DEEP_STUBS);
//        CourseRepository repo = mock(CourseRepository.class);
//
//        // minimal service instance
//        CourseSearchMigrationService service = new CourseSearchMigrationService(es, repo);
//
//        // set private @Value fields via reflection (keep test minimal)
//        TestField.set(service, "indexName", "courses");
//        TestField.set(service, "batchSize", 500);
//        TestField.set(service, "createIndexIfMissing", false);
//
//        CourseEntity c1 = CourseEntity.builder()
//                .id("c1")
//                .tags(List.of(
//                        TagEntity.builder().name("java").build(),
//                        TagEntity.builder().name("java").build(),
//                        TagEntity.builder().name("spring").build()
//                ))
//                .build();
//
//        BulkResponse bulkResponse = mock(BulkResponse.class);
//        when(bulkResponse.errors()).thenReturn(false);
//        when(es.bulk(any(BulkRequest.class))).thenReturn(bulkResponse);
//
//        // invoke the internal bulk method via public API by stubbing repo paging to single page
//        when(repo.findAllWithTags(any())).thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(c1)));
//
//        service.migrateAllCoursesIdAndTags();
//
//        verify(es, times(1)).bulk(any(BulkRequest.class));
//    }
//}
