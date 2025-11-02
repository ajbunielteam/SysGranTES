<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', ''); // Default XAMPP password is empty
define('DB_NAME', 'grantes_db');

// Create connection
function getDatabaseConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }
    
    return $conn;
}

// Check connection
function testConnection() {
    $conn = getDatabaseConnection();
    if ($conn) {
        echo "Connected successfully";
        $conn->close();
        return true;
    }
    return false;
}
?>