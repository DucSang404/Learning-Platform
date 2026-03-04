package com.freeclassroom.userservice.sagas;

import com.freeclassroom.userservice.configuration.RabbitMQConfig;
import com.freeclassroom.userservice.dto.event.*;
import com.freeclassroom.userservice.entity.user.UserEntity;
import com.freeclassroom.userservice.repository.entity.UserRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class VipRegisterConsumerService {

    UserRepository userRepository;
    RabbitTemplate rabbitTemplate;

    // Exchange and routing keys for saga pattern
    private static final String APP_EVENTS_EXCH = "app_events";
    private static final String VIP_REGISTER_ROUTING_KEY_SUCCESS = "vip.register.updated.v1";
    private static final String VIP_REGISTER_ROUTING_KEY_FAILED = "vip.register.failed.v1";

    @RabbitListener(queues = RabbitMQConfig.VIP_REGISTER_QUEUE, containerFactory = "rabbitListenerContainerFactory")
    public void receiveMessage(EventEnvelope<VipRegisterCreatedPayload> event) {
        try {
            log.info("Received message type: {}", event.getType());

            if (event.getPayload() == null) {
                log.error("Payload is null, sending failure message");
                sendFailureMessage(event, "Invalid message: payload is null");
                return;
            }

            if ("vip.register.created.v1".equals(event.getType())) {
                handleVipRegisterCreated(event);
            } else if ("vip.register.failed.v1".equals(event.getType())) {
                log.error("Received failure event for VIP registration, rolling back transaction");
                rollbackVipRegister(event);
            }
        } catch (Exception e) {
            log.error("Error processing message: {}", e.getMessage(), e);
            sendFailureMessage(event, e.getMessage());
        }
    }

    @Transactional
    protected void handleVipRegisterCreated(EventEnvelope<VipRegisterCreatedPayload> event) {
        VipRegisterCreatedPayload payload = event.getPayload();
        String userId = payload.getUserId();

        // Update user to VIP status
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        user.setIsVip(true);
        user.setDurationOfVip(payload.getDurationMonths());
        user.setUpdateVipAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("Successfully updated user {} to VIP for {} months with orderId {}", userId, payload.getDurationMonths(), payload.getOrderId());

        // Send success message
        sendSuccessMessage(event);
    }

    /**
     * Rollback VIP status when transaction fails
     * Sets isVip to false and clears duration
     */
    @Transactional
    protected void rollbackVipRegister(EventEnvelope<VipRegisterCreatedPayload> event) {
        VipRegisterCreatedPayload payload = event.getPayload();
        String userId = payload.getUserId();

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        user.setIsVip(false);
        user.setDurationOfVip(null);
        user.setUpdateVipAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("Rollback VIP for user {} with orderId {}", userId, payload.getOrderId());
        sendFailureMessage(event, "Transaction failed, rolled back VIP status");
    }

    // Send success message back to order service
    private void sendSuccessMessage(EventEnvelope<VipRegisterCreatedPayload> event) {
        VipRegisterCreatedPayload payload = event.getPayload();
        rabbitTemplate.convertAndSend(
                APP_EVENTS_EXCH,
                VIP_REGISTER_ROUTING_KEY_SUCCESS,
                EventEnvelope.<VipRegisterUpdatedPayload>builder()
                        .type(VIP_REGISTER_ROUTING_KEY_SUCCESS)
                        .payload(VipRegisterUpdatedPayload.builder()
                                .orderId(payload.getOrderId())
                                .userId(payload.getUserId())
                                .status("SUCCESS")
                                .build())
                        .correlationId(event.getCorrelationId())
                        .timestamp(LocalDateTime.now().toString())
                        .build()
        );
        log.info("Sent SUCCESS event for VIP Order {}", payload.getOrderId());
    }

    // Send failure message back to order service
    private void sendFailureMessage(EventEnvelope<VipRegisterCreatedPayload> event, String reason) {
        VipRegisterCreatedPayload payload = event.getPayload();
        if (payload == null) {
            log.error("Cannot send failure message: payload is null");
            return;
        }

        rabbitTemplate.convertAndSend(
                APP_EVENTS_EXCH,
                VIP_REGISTER_ROUTING_KEY_FAILED,
                EventEnvelope.<VipRegisterFailedPayload>builder()
                        .type(VIP_REGISTER_ROUTING_KEY_FAILED)
                        .payload(VipRegisterFailedPayload.builder()
                                .orderId(payload.getOrderId())
                                .userId(payload.getUserId())
                                .status("FAILED")
                                .reason(reason)
                                .build())
                        .correlationId(event.getCorrelationId())
                        .timestamp(LocalDateTime.now().toString())
                        .build()
        );
        log.info("Sent FAILED event for VIP Order {}", payload.getOrderId());
    }
}
