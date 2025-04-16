package com.robotcontrol;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RobotControlApplication {

    public static void main(String[] args) {
        SpringApplication.run(RobotControlApplication.class, args);
    }
}