package com.freeclassroom.userservice.configuration;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {
    public static final String EXCHANGE = "user-notification-exchange";
    public static final String APP_EVENTS_EXCHANGE = "app_events";

    //queue
    public static final String VERIFY_REGISTER_QUEUE = "register-user-queue";
    public static final String FORGOT_PASSWORD_QUEUE = "forgot-password-queue";
    public static final String VIP_REGISTER_QUEUE = "vippackage.register.service.queue";

    //routing key
    public static final String VERIFY_REGISTER_ROUTING_KEY = "user.verify.register";
    public static final String FORGOT_PASSWORD_ROUTING_KEY = "user.forgot.password";
    public static final String VIP_REGISTER_ROUTING_KEY = "vip.register.created.v1";

    @Bean
    public DirectExchange exchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange appEventsExchange() {
        return new TopicExchange(APP_EVENTS_EXCHANGE, true, false);
    }

    @Bean
    public Queue verifyRegisterQueue() {
        return new Queue(VERIFY_REGISTER_QUEUE, true);
    }

    @Bean
    public Queue forgotPasswordQueue() {
        return new Queue(FORGOT_PASSWORD_QUEUE, true);
    }

    @Bean
    public Queue vipRegisterQueue() {
        return new Queue(VIP_REGISTER_QUEUE, true);
    }

    @Bean
    public Binding bindingVerifyRegister(Queue verifyRegisterQueue, DirectExchange userNotificationExchange) {
        return BindingBuilder.bind(verifyRegisterQueue)
                .to(userNotificationExchange)
                .with(VERIFY_REGISTER_ROUTING_KEY);
    }

    @Bean
    public Binding bindingForgotPassword(Queue forgotPasswordQueue, DirectExchange userNotificationExchange) {
        return BindingBuilder.bind(forgotPasswordQueue)
                .to(userNotificationExchange)
                .with(FORGOT_PASSWORD_ROUTING_KEY);
    }

    @Bean
    public Binding bindingVipRegister(Queue vipRegisterQueue, TopicExchange appEventsExchange) {
        return BindingBuilder.bind(vipRegisterQueue)
                .to(appEventsExchange)
                .with(VIP_REGISTER_ROUTING_KEY);
    }
    // --- config rabbit mq ----

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        return rabbitTemplate;
    }

    @Bean
    public Jackson2JsonMessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter messageConverter) {

        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setAcknowledgeMode(AcknowledgeMode.AUTO);
        factory.setDefaultRequeueRejected(true);
        return factory;
    }
}
