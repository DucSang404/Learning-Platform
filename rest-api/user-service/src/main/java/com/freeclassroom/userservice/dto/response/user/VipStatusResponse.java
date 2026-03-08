package com.freeclassroom.userservice.dto.response.user;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class VipStatusResponse {
    Boolean isVip;
    Integer durationMonths;
    LocalDateTime activatedAt;
    LocalDateTime expiresAt;
    Long daysRemaining;
}
