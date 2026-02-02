package com.freeclassroom.userservice.enums;

public enum RedisStreamEnum {
    EVENT_GUEST("event:guest"),
    EVENT_USER("event:user"),
    GROUP_GUEST("guest-group"),
    GROUP_USER("user-group");

    private final String value;
    RedisStreamEnum(String value) {
        this.value = value;
    }
    public String getValue() {
        return value;
    }
}
