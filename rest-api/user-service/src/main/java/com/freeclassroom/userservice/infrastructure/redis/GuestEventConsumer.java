package com.freeclassroom.userservice.infrastructure.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import static com.freeclassroom.userservice.enums.RedisStreamEnum.EVENT_GUEST;
import static com.freeclassroom.userservice.enums.RedisStreamEnum.GROUP_GUEST;

@Component
@AllArgsConstructor
public class GuestEventConsumer {
    private final StringRedisTemplate redis;
    private final String consumerName =
            "consumer-" +
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));

    @Scheduled(fixedDelay = 5000)
    public void consume() {
        List<MapRecord<String, Object, Object>> records =
                redis.opsForStream().read(
                        Consumer.from(GROUP_GUEST.getValue(), consumerName),
                        StreamReadOptions.empty().count(10),
                        StreamOffset.create(EVENT_GUEST.getValue(), ReadOffset.lastConsumed())
                );

        if (records == null || records.isEmpty()) return;

        for (var record : records) {
            process(record);
            redis.opsForStream().acknowledge(EVENT_GUEST.getValue(), GROUP_GUEST.getValue(), record.getId());
        }
    }

    private void process(MapRecord<String, Object, Object> record) {
        Map<Object, Object>  values = record.getValue();

        String userId = values.get("userId").toString();
        String eventName = values.get("eventName").toString();
        String payload = values.get("payload").toString();

        if (userId.startsWith("guest-")) {
            userId = userId.substring("guest-".length());
        }

        if (eventName.equals("VIEW_COURSE")) {
            String courseId = extractCourseId(payload);

            String key = "guest:" + userId + ":features";

            redis.opsForHash().increment(
                    key,
                    "view_course_" + courseId,
                    1L
            );

            // Keep guest features for a limited time; refreshed on activity.
            redis.expire(key, Duration.ofDays(30));
        }
    }

    private String extractCourseId(String payload) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> map = mapper.readValue(payload, Map.class);
            return map.get("courseId").toString();
        } catch (Exception e) {
            return "";
        }
    }

    // delete consumers idle > 7 days and have no pending messages
    @Scheduled(cron = "0 0 0 * * *")
    public void cleanUpConsumers() {

        StreamInfo.XInfoConsumers consumersInfo =
                redis.opsForStream().consumers(
                        EVENT_GUEST.getValue(),
                        GROUP_GUEST.getValue()
                );

        List<StreamInfo.XInfoConsumer> consumers =
                consumersInfo.stream().toList();

        if (consumers.isEmpty()) return;

        long SEVEN_DAY_MS = 7 * 24L * 60 * 60 * 1000;

        for (StreamInfo.XInfoConsumer consumer : consumers) {

            if (consumer.consumerName().equals(consumerName)) {
                continue;
            }

            long idleTime = consumer.idleTimeMs();
            long pending = consumer.pendingCount();

            if (idleTime > SEVEN_DAY_MS && pending == 0) {
                redis.opsForStream().deleteConsumer(
                        EVENT_GUEST.getValue(),
                        Consumer.from(
                                GROUP_GUEST.getValue(),
                                consumer.consumerName()
                        )
                );

            }
        }
    }
}
