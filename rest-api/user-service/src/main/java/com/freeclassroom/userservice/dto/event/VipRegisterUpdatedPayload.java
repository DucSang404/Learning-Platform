package com.freeclassroom.userservice.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VipRegisterUpdatedPayload {
    private String orderId;
    private String userId;
    private String status;
}
