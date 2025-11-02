<?php
// Test database connection
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
require_once '../config/database.php';

try {
    $conn = getDatabaseConnection();
    
    // Check if admin_posts table exists
    $result = $conn->query("SHOW TABLES LIKE 'admin_posts'");
    
    if ($result->num_rows === 0) {
        echo json_encode([
            'success' => false,
            'message' => 'admin_posts table does not exist'
        ]);
        exit;
    }
    
    // Check for engagement columns
    $columns = ['likes', 'shares', 'comments'];
    $existingColumns = [];
    
    $columnResult = $conn->query("SHOW COLUMNS FROM admin_posts");
    while ($row = $columnResult->fetch_assoc()) {
        if (in_array($row['Field'], $columns)) {
            $existingColumns[] = $row['Field'];
        }
    }
    
    $missingColumns = array_diff($columns, $existingColumns);
    
    $response = [
        'success' => true,
        'message' => 'Database connection successful',
        'table_exists' => true,
        'columns' => [
            'existing' => $existingColumns,
            'missing' => $missingColumns
        ]
    ];
    
    if (!empty($missingColumns)) {
        $response['message'] .= ' but some engagement columns are missing. Run setup_engagement_columns.php';
        $response['action_needed'] = true;
    }
    
    echo json_encode($response);
    
    $conn->close();
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

