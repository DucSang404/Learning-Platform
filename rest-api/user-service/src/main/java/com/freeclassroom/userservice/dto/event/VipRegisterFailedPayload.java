package com.freeclassroom.userservice.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VipRegisterFailedPayload {
    private String orderId;
    private String userId;
    private String status;
    private String reason;
}
