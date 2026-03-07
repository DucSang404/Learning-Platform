//package com.freeclassroom.courseservice.search;
//
//import co.elastic.clients.elasticsearch.ElasticsearchClient;
//import co.elastic.clients.elasticsearch._types.ElasticsearchException;
//import co.elastic.clients.elasticsearch._types.mapping.Property;
//import co.elastic.clients.elasticsearch.core.BulkRequest;
//import co.elastic.clients.elasticsearch.core.BulkResponse;
//import co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
//import com.freeclassroom.courseservice.entity.course.CourseEntity;
//import com.freeclassroom.courseservice.repository.entity.CourseRepository;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.data.domain.Page;
//import org.springframework.data.domain.PageRequest;
//import org.springframework.data.domain.Pageable;
//import org.springframework.stereotype.Service;
//
//import java.io.IOException;
//import java.util.ArrayList;
//import java.util.List;
//
//@Slf4j
//@Service
//@RequiredArgsConstructor
//public class CourseSearchMigrationService {
//
//    private final ElasticsearchClient elasticsearchClient;
//    private final CourseRepository courseRepository;
//
//    @Value("${app.elasticsearch.course-index:courses}")
//    private String indexName;
//
//    @Value("${app.migration.elasticsearch.batch-size:500}")
//    private int batchSize;
//
//    @Value("${app.migration.elasticsearch.create-index-if-missing:true}")
//    private boolean createIndexIfMissing;
//
//    public void migrateAllCoursesIdAndTags() throws IOException {
//        if (createIndexIfMissing) {
//            ensureIndexExists();
//        }
//
//        int pageNumber = 0;
//        long totalIndexed = 0;
//
//        while (true) {
//            Pageable pageable = PageRequest.of(pageNumber, batchSize);
//            Page<CourseEntity> page = courseRepository.findAllWithTags(pageable);
//            if (page.isEmpty()) {
//                break;
//            }
//
//            BulkResponse bulkResponse = bulkUpsertCourses(page.getContent());
//            if (bulkResponse.errors()) {
//                log.warn("Elasticsearch bulk had errors. Took: {}ms", bulkResponse.took());
//            }
//
//            totalIndexed += page.getNumberOfElements();
//            log.info("Migrated courses to ES: {}/{} (page {})", totalIndexed, page.getTotalElements(), pageNumber);
//
//            if (!page.hasNext()) {
//                break;
//            }
//            pageNumber++;
//        }
//
//        log.info("Course migration finished. Total indexed: {} into index '{}'", totalIndexed, indexName);
//    }
//
//    private void ensureIndexExists() throws IOException {
//        boolean exists = elasticsearchClient.indices().exists(e -> e.index(indexName)).value();
//        if (exists) {
//            return;
//        }
//
//        log.info("Elasticsearch index '{}' not found. Creating...", indexName);
//        elasticsearchClient.indices().create(c -> c
//                .index(indexName)
//                .mappings(m -> m
//                        .properties("id", Property.of(p -> p.keyword(k -> k)))
//                        .properties("tags", Property.of(p -> p.keyword(k -> k)))
//                )
//        );
//        log.info("Elasticsearch index '{}' created.", indexName);
//    }
//
//    private BulkResponse bulkUpsertCourses(List<CourseEntity> courses) throws IOException {
//        List<BulkOperation> operations = new ArrayList<>(courses.size());
//
//        for (CourseEntity course : courses) {
//            // Avoid NPE and keep predictable payload.
//            List<String> tagNames = course.getTags() == null ? List.of() : course.getTags().stream()
//                    .filter(t -> t != null && t.getName() != null)
//                    .map(t -> t.getName())
//                    .distinct()
//                    .toList();
//
//            CourseSearchDocument doc = CourseSearchDocument.builder()
//                    .id(course.getId())
//                    .tags(tagNames)
//                    .build();
//
//            operations.add(BulkOperation.of(o -> o
//                    .index(i -> i
//                            .index(indexName)
//                            .id(course.getId())
//                            .document(doc)
//                    )
//            ));
//        }
//
//        BulkRequest request = new BulkRequest.Builder()
//                .operations(operations)
//                .build();
//
//        try {
//            return elasticsearchClient.bulk(request);
//        } catch (ElasticsearchException ex) {
//            // Re-throw as IOException so caller can decide fail-fast.
//            throw new IOException("Elasticsearch bulk indexing failed: " + ex.getMessage(), ex);
//        }
//    }
//}
