<?php
header('Content-Type: text/html; charset=utf-8');
require_once '../config/database.php';

$conn = getDatabaseConnection();

echo "<h1>Check Post Images in Database</h1>";

// Get latest post
$result = $conn->query("SELECT id, content, LENGTH(images) as img_length, SUBSTRING(images, 1, 100) as img_preview FROM admin_posts ORDER BY id DESC LIMIT 5");

if ($result->num_rows > 0) {
    echo "<h2>Latest Posts:</h2>";
    while ($row = $result->fetch_assoc()) {
        echo "<div style='border: 1px solid #ccc; padding: 15px; margin: 10px;'>";
        echo "<h3>Post ID: " . $row['id'] . "</h3>";
        echo "<p><strong>Content:</strong> " . substr($row['content'], 0, 50) . "...</p>";
        echo "<p><strong>Image Length:</strong> " . $row['img_length'] . " bytes</p>";
        echo "<p><strong>Image Preview (first 100 chars):</strong> " . htmlspecialchars($row['img_preview']) . "</p>";
        
        // Try to decode and display
        $fullResult = $conn->query("SELECT images FROM admin_posts WHERE id = " . $row['id']);
        if ($fullRow = $fullResult->fetch_assoc()) {
            $images = json_decode($fullRow['images'], true);
            if (is_array($images) && count($images) > 0) {
                echo "<p><strong>Images array length:</strong> " . count($images) . "</p>";
                echo "<p><strong>First image length:</strong> " . strlen($images[0]) . "</p>";
                echo "<p><strong>First 50 chars of image:</strong> " . substr($images[0], 0, 50) . "...</p>";
                
                // Try to display the image
                if (strlen($images[0]) > 0) {
                    echo "<img src='" . $images[0] . "' style='max-width: 300px; border: 2px solid red;'>";
                }
            } else {
                echo "<p style='color: red;'>Images array is empty or invalid</p>";
            }
        }
        echo "</div>";
    }
} else {
    echo "<p>No posts found</p>";
}

$conn->close();
?>

