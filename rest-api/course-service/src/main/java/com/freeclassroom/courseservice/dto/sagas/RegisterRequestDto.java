package com.freeclassroom.courseservice.dto.sagas;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RegisterRequestDto {
    @JsonProperty("orderId")
    private String orderId;

    @JsonProperty("userId")
    private String userId;

    @JsonProperty("amount")
    private int amount;

    @JsonProperty("items")
    private List<Item> items;

    public static class Item {
        private String course_id;
        private int price;

        public Item() {}

        public Item(String course_id, int price) {
            this.course_id = course_id;
            this.price = price;
        }

        @com.fasterxml.jackson.annotation.JsonProperty("course_id")
        public String getCourse_id() { return course_id; }
        @com.fasterxml.jackson.annotation.JsonProperty("course_id")
        public void setCourse_id(String course_id) { this.course_id = course_id; }

        @com.fasterxml.jackson.annotation.JsonProperty("price")
        public int getPrice() { return price; }
        @com.fasterxml.jackson.annotation.JsonProperty("price")
        public void setPrice(int price) { this.price = price; }
    }
}
