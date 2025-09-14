-- PostgreSQL Database Setup for Trading Info
-- Run this in PostgreSQL as superuser

-- Create database
CREATE DATABASE trading_info;

-- Create user (use your existing credentials)
CREATE USER trading_user WITH PASSWORD 'Ke5zrdsf';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE trading_info TO trading_user;

-- Connect to the database
\c trading_info;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO trading_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trading_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trading_user;

-- The Spring Boot app will create tables automatically with spring.jpa.hibernate.ddl-auto=update