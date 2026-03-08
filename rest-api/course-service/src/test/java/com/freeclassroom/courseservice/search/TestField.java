package com.freeclassroom.courseservice.search;

import java.lang.reflect.Field;

final class TestField {
    private TestField() {}

    static void set(Object target, String fieldName, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(fieldName);
            f.setAccessible(true);
            f.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

