package com.freeclassroom.userservice.infrastructure.redis;

import com.freeclassroom.userservice.enums.RedisStreamEnum;
import io.lettuce.core.RedisBusyException;
import lombok.AllArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import static com.freeclassroom.userservice.enums.RedisStreamEnum.*;

@Component
@AllArgsConstructor
public class RedisStreamInitializer {
    private final StringRedisTemplate redisTemplate;
//    @EventListener(ApplicationReadyEvent.class)
//    public void init() {
//        createGroupIfNotExists(EVENT_GUEST.getValue(), GROUP_GUEST.getValue());
//        createGroupIfNotExists(EVENT_USER.getValue(), GROUP_USER.getValue());
//    }
//
//    private void createGroupIfNotExists(String stream, String group) {
//        try {
//            redisTemplate.opsForStream()
//                    .createGroup(stream, ReadOffset.latest(), group);
//        } catch (RedisSystemException e) {
//            Throwable cause = e.getCause();
//            if (cause instanceof RedisBusyException) {
//                System.out.println("Redis group already exists: " + group);
//            } else {
//                throw e;
//            }
//        }
//    }

}

