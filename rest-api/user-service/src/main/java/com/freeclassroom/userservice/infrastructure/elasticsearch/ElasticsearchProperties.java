package com.freeclassroom.userservice.infrastructure.elasticsearch;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "elasticsearch")
public class ElasticsearchProperties {
    /** Example: http://localhost:9200 */
    private String url;

    private Index index = new Index();

    @Data
    public static class Index {
        /** Index for user personalization signals (course_score, tag_score, last_action). */
        private String trackingEvents = "user-personalization-signals";

        /** Index for courses catalog (courseId + tags). */
        private String courses = "courses";
    }
}
