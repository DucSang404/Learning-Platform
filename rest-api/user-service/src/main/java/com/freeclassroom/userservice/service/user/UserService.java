package com.freeclassroom.userservice.service.user;

import com.example.grpc.course.GetCourseAdminDataResponse;
import com.example.grpc.course.TotalBlogResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.freeclassroom.userservice.configuration.RabbitMQConfig;
import com.freeclassroom.userservice.dto.request.auth.Identity;
import com.freeclassroom.userservice.dto.request.personal.TrackingEventRequest;
import com.freeclassroom.userservice.dto.request.user.CreationUserRequest;
import com.freeclassroom.userservice.dto.request.user.UpdateUserRequest;
import com.freeclassroom.userservice.dto.response.ApiResponse;
import com.freeclassroom.userservice.dto.response.admin.DataAdminHome;
import com.freeclassroom.userservice.dto.response.auth.CheckForgotPasswordResponse;
import com.freeclassroom.userservice.dto.response.user.GetUserResponse;
import com.freeclassroom.userservice.dto.response.user.MyProfileResponse;
import com.freeclassroom.userservice.dto.response.user.UserResponse;
import com.freeclassroom.userservice.entity.certificate.Certificate;
import com.freeclassroom.userservice.entity.redis.OTPForgetPassword;
import com.freeclassroom.userservice.entity.redis.PendingUserEntity;
import com.freeclassroom.userservice.entity.user.UserEntity;
import com.freeclassroom.userservice.enums.CertificateStatus;
import com.freeclassroom.userservice.enums.entity.EnumAccountStatus;
import com.freeclassroom.userservice.exception.CustomExeption;
import com.freeclassroom.userservice.exception.ErrorCode;
import com.freeclassroom.userservice.grpc.client.BlogGrpcClient;
import com.freeclassroom.userservice.grpc.client.CourseGrpcClient;
import com.freeclassroom.userservice.mapper.user.UserMapper;
import com.freeclassroom.userservice.repository.entity.CertificateRepository;
import com.freeclassroom.userservice.repository.entity.UserRepository;
import com.freeclassroom.userservice.repository.redis.OTPForgetPasswordRepository;
import com.freeclassroom.userservice.repository.redis.PendingUserRepository;
import com.freeclassroom.userservice.service.file.UploadFileService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.connection.DataType;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static com.freeclassroom.userservice.enums.RedisStreamEnum.EVENT_GUEST;
import static com.freeclassroom.userservice.enums.RedisStreamEnum.EVENT_USER;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserService implements IUserService {
    PendingUserRepository pendingUserRepo;
    OTPForgetPasswordRepository otpForgetPasswordRepo;
    UserMapper userMapper;
    UploadFileService uploadFileService;

    CourseGrpcClient courseGrpcClient;
    BlogGrpcClient blogGrpcClient;

    // template rabbitmq
    RabbitTemplate rabbitTemplate;
    RabbitMQConfig rabbitMQConfig;
    StringRedisTemplate redis;

    RedisOperations<String, OTPForgetPassword> redisOps;

    //password encoder
    PasswordEncoder passwordEncoder;

    @NonFinal
    @Value("${app.frontend.verify-url}")
    private String verifyUrl;

    @NonFinal
    @Value("${app.frontend.verify-otp-forgot-password-url}")
    private String verifyForgotPassword;

    private final UserRepository userRepository;
    private final CertificateRepository certificateRepository;

    private String normalizeGuestId(String rawGuestId) {
        if (rawGuestId == null) return null;
        String trimmed = rawGuestId.trim();
        if (trimmed.startsWith("guest-")) {
            return trimmed.substring("guest-".length());
        }
        return trimmed;
    }

    public ApiResponse<UserResponse> registerUser(CreationUserRequest request) {
        // check user exits
        if (userRepository.existsByEmail(request.getEmail()))
            throw new CustomExeption(ErrorCode.EMAIL_EXISTED);

        if (userRepository.existsByUsername(request.getUsername()))
            throw new CustomExeption(ErrorCode.USERNAME_EXISTED);

        PendingUserEntity redisEntity = userMapper.toEntity(request);

        // generate token for verify
        redisEntity.setToken(UUID.randomUUID().toString());
        redisEntity.setStatus(EnumAccountStatus.ACTIVE);

        // save in Redis with TTL
        redisEntity = pendingUserRepo.save(redisEntity);

        // -> send to notification service
        redisEntity.setToken("http://" + verifyUrl + redisEntity.getToken());
        rabbitTemplate.convertAndSend(rabbitMQConfig.EXCHANGE, rabbitMQConfig.VERIFY_REGISTER_ROUTING_KEY,
                redisEntity);

        UserResponse response = UserResponse.builder()
                .name(redisEntity.getName())
                .email(redisEntity.getEmail())
                .build();

        return ApiResponse.<UserResponse>builder()
                .code(200)
                .message("Vui lòng kiểm tra email để tiếp tục !")
                .result(response)
                .build();
    }


    public ApiResponse<UserResponse> verifySignUp(String token) {
        // get token in redis
        PendingUserEntity newUser = pendingUserRepo.findById(token)
                .orElseThrow(() -> new CustomExeption(ErrorCode.WRONG_VERFY_TOKEN));

        // check user exitst
        if (userRepository.existsByUsernameOrEmail(newUser.getUsername(), newUser.getEmail()))
            throw new CustomExeption(ErrorCode.USER_EXISTED);

        // endcode password
        newUser.setPassword(
                passwordEncoder.encode(newUser.getPassword())
        );

        // Convert PendingUserEntity -> UserEntity
        UserEntity newUserEntity = userRepository.save(userMapper.toEntity(newUser));

        // del in redis
        pendingUserRepo.delete(newUser);

        UserResponse response = UserResponse.builder()
                .name(newUserEntity.getName())
                .email(newUserEntity.getEmail())
                .build();

        return ApiResponse.<UserResponse>builder()
                .code(200)
                .message("Xác thực thành công, chào mứng bạn đến với Learnova!")
                .result(response)
                .build();
    }

    public ApiResponse<Void> forgotPassword(String email) {
        // check user exits
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new CustomExeption(ErrorCode.USER_NOT_FOUND));

        OTPForgetPassword newOtpForgetPassword = OTPForgetPassword.builder()
                .email(email)
                .name(user.getName())
                .build();

        newOtpForgetPassword = otpForgetPasswordRepo.save(newOtpForgetPassword);

        // -> send to notification service
        newOtpForgetPassword.setToken("http://" + verifyForgotPassword + newOtpForgetPassword.getToken());
        rabbitTemplate.convertAndSend(rabbitMQConfig.EXCHANGE, rabbitMQConfig.FORGOT_PASSWORD_ROUTING_KEY,
                newOtpForgetPassword);


        return ApiResponse.<Void>builder()
                .code(200)
                .message("Vui lòng kiểm tra email để tiếp tục !")
                .build();
    }

    @Override
    public ApiResponse<CheckForgotPasswordResponse> checkForgotPassword(String code) {
        // get token in redis
        OTPForgetPassword forgetPassword = otpForgetPasswordRepo.findById(code)
                .orElseThrow(() -> new CustomExeption(ErrorCode.WRONG_VERFY_TOKEN));

        Long ttl = redisOps.getExpire("pending-forget-password:" + code, TimeUnit.SECONDS);

        if (ttl == null || ttl < 0) {
            throw new CustomExeption(ErrorCode.OTP_EXPIRED);
        }

        return ApiResponse.<CheckForgotPasswordResponse>builder()
                .code(forgetPassword != null ? 200 : 0)
                .result(
                        CheckForgotPasswordResponse.builder()
                                .timeToLive(ttl)
                                .build()
                )
                .message(forgetPassword != null ? "Yêu cầu hợp lệ, bạn có thể đặt lại mật khẩu."
                        : "Yêu cầu đã hết hạn, vui lòng thử lại sau.")
                .build();
    }

    @Override
    public ApiResponse<GetUserResponse> getUser(String id) {
        try {
            UserEntity user = userRepository.findById(id)
                    .orElseThrow(() -> new CustomExeption(ErrorCode.USER_NOT_FOUND));

            GetUserResponse response = userMapper.toDto(user);

            return ApiResponse.<GetUserResponse>builder()
                    .code(HttpStatus.OK.value())
                    .message("Get user successfully")
                    .result(response)
                    .build();
        } catch (Exception e) {
            return ApiResponse.<GetUserResponse>builder()
                    .code(HttpStatus.INTERNAL_SERVER_ERROR.value())
                    .message("Unexpected error: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public ApiResponse<MyProfileResponse> geyMyProfile(String id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new CustomExeption(ErrorCode.USER_NOT_FOUND));

        MyProfileResponse response = userMapper.toMyProfileResponse(user);

        return ApiResponse.<MyProfileResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Lấy thông tin profile thành công !")
                .result(response)
                .build();
    }

    @Override
    public ApiResponse<GetUserResponse> updateUser(String id, UpdateUserRequest request) {
        try {
            UserEntity user = userRepository.findById(id)
                    .orElseThrow(() -> new CustomExeption(ErrorCode.USER_NOT_FOUND));

            if (request.getDescription() != null && !request.getDescription().equals(user.getDescription())) {
                user.setDescription(request.getDescription());
            }
            if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
                user.setEmail(request.getEmail());
            }
            if (request.getName() != null && !request.getName().equals(user.getName())) {
                user.setName(request.getName());
            }
            if (request.getPhone() != null && !request.getPhone().equals(user.getPhone())) {
                user.setPhone(request.getPhone());
            }
            if (request.getPosition() != null && !request.getPosition().equals(user.getPosition())) {
                user.setPosition(request.getPosition());
            }
            if (request.getStatus() != null && !request.getStatus().equals(user.getStatus())) {
                user.setStatus(request.getStatus());
            }

            if (request.getImage() != null && !request.getImage().isEmpty()) {
                String uploadedUrl = uploadFileService.uploadFile(request.getImage());
                user.setImage(uploadedUrl);
            }

            userRepository.save(user);

            GetUserResponse response = userMapper.toDto(user);

            return ApiResponse.<GetUserResponse>builder()
                    .code(HttpStatus.OK.value())
                    .message("Chỉnh sửa thông tin profile thành công !")
                    .result(response)
                    .build();
        } catch (CustomExeption e) {
            return ApiResponse.<GetUserResponse>builder()
                    .code(HttpStatus.OK.value())
                    .message("Chỉnh sửa thông tin profile thất bại !")
                    .result(null)
                    .build();
        } catch (Exception e) {
            throw new CustomExeption(ErrorCode.UNCATEGORIZED_EXEPTION);
        }
    }

    @Override
    public ApiResponse<DataAdminHome> getAdminData() {
        DataAdminHome data = new DataAdminHome();

        try {
            // gRPC Course length and User length
            GetCourseAdminDataResponse courseResponse = courseGrpcClient.getCourseAdminData();
            if (courseResponse != null) {
                data.setCourseCnt(courseResponse.getTotalCourse());
                data.setInstructorCnt(courseResponse.getTotalInstructor());
            } else {
                data.setCourseCnt(0);
                data.setInstructorCnt(0);
            }
            System.out.println("RESPONSE COURSE GRPC: " + courseResponse);

            // gRPC Blogs length
            TotalBlogResponse blogResponse = blogGrpcClient.getTotalBlog();
            data.setBlogCnt(blogResponse != null ? blogResponse.getTotal() : 0);
            System.out.println("RESPONSE BLOG GRPC: " + blogResponse);

            // Lấy chứng chỉ có status PENDING
            List<Certificate> certificateList = certificateRepository.findCertificatePending(CertificateStatus.PENDING);
            data.setCertificateCnt(certificateList != null ? certificateList.size() : 0);

            return ApiResponse.<DataAdminHome>builder()
                    .code(HttpStatus.OK.value())
                    .message("Lấy data thành công!")
                    .result(data)
                    .build();

        } catch (Exception e) {
            // Log lỗi chi tiết
            e.printStackTrace();
            return ApiResponse.<DataAdminHome>builder()
                    .code(HttpStatus.INTERNAL_SERVER_ERROR.value())
                    .message("Lấy data thất bại: " + e.getMessage())
                    .result(data)
                    .build();
        }
    }

    @Override
    public ApiResponse<Void> trackingEvent(Identity identity, TrackingEventRequest trackingEvent) {
        if (identity == null) {
            return ApiResponse.<Void>builder()
                    .code(401)
                    .message("Missing identity")
                    .build();
        }

        // redis stream logic to track event
        boolean isUser = "USER".equals(identity.getType());
        String normalizedId = isUser ? identity.getId() : normalizeGuestId(identity.getId());
        String stream = isUser ? EVENT_USER.getValue() : EVENT_GUEST.getValue();

        // if user save database ()

        // merge when guest login to user ()

        if (trackingEvent != null && trackingEvent.getEventName() != null) {
            String event = trackingEvent.getEventName();
            if ("VIEW_COURSE".equals(event) && trackingEvent.getPayload() != null) {
                String courseId = trackingEvent.getPayload().get("courseId");
                if (courseId != null && !courseId.isBlank() && normalizedId != null && !normalizedId.isBlank()) {
                    String featuresKey = isUser
                            ? ("user:" + normalizedId + ":features")
                            : ("guest:" + normalizedId + ":features");

                    redis.opsForHash().increment(featuresKey, "view_course_" + courseId, 1d);

                    if (!isUser) {
                        redis.expire(featuresKey, Duration.ofDays(30));
                    }
                }
            }
        }

        String payloadJson = "";
        if (trackingEvent != null && trackingEvent.getPayload() != null && !trackingEvent.getPayload().isEmpty()) {
            try {
                payloadJson = new ObjectMapper().writeValueAsString(trackingEvent.getPayload());
            } catch (JsonProcessingException ignored) {
                payloadJson = "";
            }
        }

        String eventName = trackingEvent != null && trackingEvent.getEventName() != null
                ? trackingEvent.getEventName()
                : "";

        String streamKey = stream;

        RecordId recordId = redis.opsForStream().add(
            streamKey,
                Map.of(
                "userId", normalizedId == null ? "" : normalizedId,
                        "eventName", eventName,
                        "payload", payloadJson,
                        "createdAt", String.valueOf(System.currentTimeMillis())
                )
        );

        // Limit 10000 record lastest
        redis.opsForStream().trim(streamKey, 10_000);

        if (recordId == null) {
            return ApiResponse.<Void>builder()
                    .code(500)
                    .message("Failed to write event to redis stream")
                    .build();
        }

        return ApiResponse.<Void>builder()
                .message("Personal event tracked successfully")
                .build();
    }

    public void mergeGuestToUser(String guestId, String userId) {
        if (guestId == null || guestId.isBlank() || userId == null || userId.isBlank()) {
            return;
        }

        String normalizedGuestId = normalizeGuestId(guestId);
        if (normalizedGuestId == null || normalizedGuestId.isBlank()) {
            return;
        }

        String guestFeaturesKey = "guest:" + normalizedGuestId + ":features";
        String legacyGuestFeaturesKey = "guest:guest-" + normalizedGuestId + ":features";
        String userFeaturesKey = "user:" + userId + ":features";

        DataType keyType = redis.type(guestFeaturesKey);
        if (keyType == null || DataType.NONE.equals(keyType) || !DataType.HASH.equals(keyType)) {
            DataType legacyType = redis.type(legacyGuestFeaturesKey);
            if (legacyType == null || DataType.NONE.equals(legacyType) || !DataType.HASH.equals(legacyType)) {
                return;
            }
            guestFeaturesKey = legacyGuestFeaturesKey;
        }

        Map<Object, Object> guestFeatures = redis.opsForHash().entries(guestFeaturesKey);
        if (guestFeatures == null || guestFeatures.isEmpty()) {
            return;
        }

        guestFeatures.forEach((feature, score) -> {
            String field = feature == null ? "" : feature.toString();
            if (field.isBlank() || score == null) return;

            double delta;
            try {
                delta = Double.parseDouble(score.toString());
            } catch (NumberFormatException e) {
                return;
            }

            if (delta == 0d) return;

            redis.opsForHash().increment(userFeaturesKey, field, delta);
        });

        redis.delete(guestFeaturesKey);
    }


    public ApiResponse<UserResponse> verifyForgotPassword(String code, String newPassword) {
        // get token in redis
        OTPForgetPassword forgetPassword = otpForgetPasswordRepo.findById(code)
                .orElseThrow(() -> new CustomExeption(ErrorCode.WRONG_VERFY_TOKEN));

        // update password
        UserEntity user = userRepository.findByEmail(forgetPassword.getEmail())
                .orElseThrow(() -> new CustomExeption(ErrorCode.USER_NOT_FOUND));

        // endcode password
        user.setPassword(
                passwordEncoder.encode(newPassword)
        );

        user = userRepository.save(user);

        return ApiResponse.<UserResponse>builder()
                .code(200)
                .message("Đã đổi mật khẩu thành công !, vui lòng đăng nhập lại để trải nghiệm dịch vụ của chúng tôi !")
                .result(
                        UserResponse.builder()
                                .email(user.getEmail())
                                .name(user.getName())
                                .build()
                )
                .build();
    }
}
