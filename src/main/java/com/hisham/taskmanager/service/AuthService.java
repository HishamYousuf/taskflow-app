package com.hisham.taskmanager.service;

import com.hisham.taskmanager.dto.auth.AuthResponse;
import com.hisham.taskmanager.dto.auth.LoginRequest;
import com.hisham.taskmanager.dto.auth.RegisterRequest;

public interface AuthService {

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);
}
