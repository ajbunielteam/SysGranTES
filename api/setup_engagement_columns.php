<?php
// Setup engagement columns for admin_posts table
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once '../config/database.php';

try {
    $conn = getDatabaseConnection();
    
    // Check if columns exist and add them if they don't
    $columnsToCheck = ['likes', 'shares', 'comments'];
    
    foreach ($columnsToCheck as $column) {
        $query = "SELECT COLUMN_NAME 
                  FROM INFORMATION_SCHEMA.COLUMNS 
                  WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'admin_posts' 
                  AND COLUMN_NAME = '$column'";
        
        $result = $conn->query($query);
        
        if ($result->num_rows === 0) {
            // Column doesn't exist, add it
            if ($column === 'comments') {
                $addColumnQuery = "ALTER TABLE admin_posts ADD COLUMN $column TEXT DEFAULT '[]'";
            } else {
                $addColumnQuery = "ALTER TABLE admin_posts ADD COLUMN $column INT DEFAULT 0";
            }
            
            if ($conn->query($addColumnQuery)) {
                echo json_encode([
                    'success' => true,
                    'message' => "Column '$column' added successfully"
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => "Failed to add column '$column': " . $conn->error
                ]);
            }
        }
    }
    
    // Update existing posts to have default values
    $updateQuery = "UPDATE admin_posts 
                    SET likes = COALESCE(likes, 0),
                        shares = COALESCE(shares, 0),
                        comments = COALESCE(NULLIF(comments, ''), '[]')
                    WHERE likes IS NULL OR shares IS NULL OR comments IS NULL OR comments = ''";
    
    $conn->query($updateQuery);
    
    $conn->close();
    
    echo json_encode([
        'success' => true,
        'message' => 'Engagement columns setup completed successfully'
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>

