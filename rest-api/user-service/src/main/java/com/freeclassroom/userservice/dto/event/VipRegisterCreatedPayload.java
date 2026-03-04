package com.freeclassroom.userservice.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VipRegisterCreatedPayload {
    private String orderId;
    private String userId;
    private Double amount;
    private Integer durationMonths;
}
