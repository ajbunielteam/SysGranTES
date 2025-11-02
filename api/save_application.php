<?php
// Disable error display and ensure JSON output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 3600');
    http_response_code(200);
    exit();
}

// Set CORS headers for actual request
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

// Handle both JSON and FormData requests
$isFormData = isset($_FILES['photo']) || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false);

if ($isFormData) {
    // Extract from $_POST and $_FILES
    $studentId = $_POST['studentId'] ?? '';
    $lastName = $_POST['lastName'] ?? '';
    $givenName = $_POST['givenName'] ?? '';
    $extName = $_POST['extName'] ?? '';
    $sex = $_POST['sex'] ?? '';
    $birthdate = $_POST['birthdate'] ?? null;
    $programName = $_POST['programName'] ?? '';
    $yearLevel = $_POST['yearLevel'] ?? '';
    $fatherName = $_POST['fatherName'] ?? '';
    $motherName = $_POST['motherName'] ?? '';
    $familyMonthlyIncome = isset($_POST['familyMonthlyIncome']) ? floatval($_POST['familyMonthlyIncome']) : 0;
    $incomeRange = $_POST['incomeRange'] ?? '';
    $province = $_POST['province'] ?? '';
    $municipality = $_POST['municipality'] ?? '';
    $streetBarangay = $_POST['streetBarangay'] ?? '';
    $zipCode = $_POST['zipCode'] ?? '';
    $contactNumber = $_POST['contactNumber'] ?? '';
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? null;
    $isPwd = isset($_POST['isPwd']) && $_POST['isPwd'] == '1' ? 1 : 0;
    $isIndigenous = isset($_POST['isIndigenous']) && $_POST['isIndigenous'] == '1' ? 1 : 0;
    $submittedAt = isset($_POST['submittedAt']) ? $_POST['submittedAt'] : date('Y-m-d H:i:s');
    $photoFile = $_FILES['photo'] ?? null;
} else {
    // Extract from JSON
    $data = json_decode(file_get_contents('php://input'), true);
    $studentId = $data['studentId'] ?? '';
    $lastName = $data['lastName'] ?? '';
    $givenName = $data['givenName'] ?? '';
    $extName = $data['extName'] ?? '';
    $sex = $data['sex'] ?? '';
    $birthdate = $data['birthdate'] ?? null;
    $programName = $data['programName'] ?? '';
    $yearLevel = $data['yearLevel'] ?? '';
    $fatherName = $data['fatherName'] ?? '';
    $motherName = $data['motherName'] ?? '';
    $familyMonthlyIncome = isset($data['familyMonthlyIncome']) ? floatval($data['familyMonthlyIncome']) : 0;
    $incomeRange = $data['incomeRange'] ?? '';
    $province = $data['province'] ?? '';
    $municipality = $data['municipality'] ?? '';
    $streetBarangay = $data['streetBarangay'] ?? '';
    $zipCode = $data['zipCode'] ?? '';
    $contactNumber = $data['contactNumber'] ?? '';
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? null;
    $isPwd = isset($data['isPwd']) && $data['isPwd'] ? 1 : 0;
    $isIndigenous = isset($data['isIndigenous']) && $data['isIndigenous'] ? 1 : 0;
    $submittedAt = isset($data['submittedAt']) ? $data['submittedAt'] : date('Y-m-d H:i:s');
    $photoFile = null;
}

$status = 'pending';

$conn = getDatabaseConnection();

// Check if applications table exists, if not create it
$tableCheck = $conn->query("SHOW TABLES LIKE 'applications'");
$tableExists = $tableCheck && $tableCheck->num_rows > 0;

// Check if student already has a submitted application
// Check by email or student_id (only if table exists)
if ($tableExists) {
    $emailCheck = $conn->prepare("SELECT id FROM applications WHERE email = ?");
    $emailCheck->bind_param("s", $email);
    $emailCheck->execute();
    $emailResult = $emailCheck->get_result();
    
    if ($emailResult->num_rows > 0) {
        echo json_encode([
            'success' => false,
            'message' => 'You have already submitted an application. Only one application per student is allowed.'
        ]);
        $emailCheck->close();
        $conn->close();
        exit;
    }
    $emailCheck->close();
    
    // Also check by student_id
    if (!empty($studentId)) {
        $studentIdCheck = $conn->prepare("SELECT id FROM applications WHERE student_id = ?");
        $studentIdCheck->bind_param("s", $studentId);
        $studentIdCheck->execute();
        $studentIdResult = $studentIdCheck->get_result();
        
        if ($studentIdResult->num_rows > 0) {
            echo json_encode([
                'success' => false,
                'message' => 'You have already submitted an application. Only one application per student is allowed.'
            ]);
            $studentIdCheck->close();
            $conn->close();
            exit;
        }
        $studentIdCheck->close();
    }
}

if (!$tableExists) {
    // Create applications table with password and photo_path columns
    $createTable = "CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(100),
        last_name VARCHAR(255),
        given_name VARCHAR(255),
        ext_name VARCHAR(50),
        sex VARCHAR(20),
        birthdate DATE,
        program_name VARCHAR(255),
        year_level VARCHAR(50),
        father_name VARCHAR(255),
        mother_name VARCHAR(255),
        family_monthly_income DECIMAL(12, 2),
        income_range VARCHAR(100),
        province VARCHAR(255),
        municipality VARCHAR(255),
        street_barangay VARCHAR(255),
        zip_code VARCHAR(20),
        contact_number VARCHAR(50),
        email VARCHAR(255),
        password VARCHAR(255) NULL,
        photo_path VARCHAR(500) NULL,
        is_pwd TINYINT(1) DEFAULT 0,
        is_indigenous TINYINT(1) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id),
        INDEX idx_email (email),
        INDEX idx_status (status)
    )";
    
    if (!$conn->query($createTable)) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to create applications table: ' . $conn->error
        ]);
        $conn->close();
        exit;
    }
    $tableExists = true;
}

// Check if password column exists, if not add it (for existing tables)
if ($tableExists) {
    $passwordColumnCheck = $conn->query("SHOW COLUMNS FROM applications LIKE 'password'");
    if (!$passwordColumnCheck || $passwordColumnCheck->num_rows == 0) {
        $conn->query("ALTER TABLE applications ADD COLUMN password VARCHAR(255) NULL AFTER email");
    }
    
    // Check if photo_path column exists, if not add it
    $photoColumnCheck = $conn->query("SHOW COLUMNS FROM applications LIKE 'photo_path'");
    if (!$photoColumnCheck || $photoColumnCheck->num_rows == 0) {
        $conn->query("ALTER TABLE applications ADD COLUMN photo_path VARCHAR(500) NULL AFTER password");
    }
}

// Handle photo upload
$photoPath = null;
if ($photoFile && isset($photoFile['tmp_name']) && !empty($photoFile['tmp_name'])) {
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    $fileType = $photoFile['type'];
    
    if (!in_array($fileType, $allowedTypes)) {
        echo json_encode([
            'success' => false,
            'message' => 'Invalid file type. Please upload a JPG, PNG, or GIF image.'
        ]);
        $conn->close();
        exit;
    }
    
    // Validate file size (5MB max)
    if ($photoFile['size'] > 5 * 1024 * 1024) {
        echo json_encode([
            'success' => false,
            'message' => 'File size exceeds 5MB limit.'
        ]);
        $conn->close();
        exit;
    }
    
    // Create uploads directory if it doesn't exist
    $uploadDir = __DIR__ . '/../uploads/applications/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generate unique filename
    $fileExtension = pathinfo($photoFile['name'], PATHINFO_EXTENSION);
    $fileName = 'photo_' . time() . '_' . uniqid() . '.' . $fileExtension;
    $targetPath = $uploadDir . $fileName;
    
    // Move uploaded file
    if (move_uploaded_file($photoFile['tmp_name'], $targetPath)) {
        $photoPath = 'uploads/applications/' . $fileName;
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to upload photo. Please try again.'
        ]);
        $conn->close();
        exit;
    }
}

// Insert application data (with or without password/photo columns)
$passwordColumnExists = $conn->query("SHOW COLUMNS FROM applications LIKE 'password'")->num_rows > 0;
$photoColumnExists = $conn->query("SHOW COLUMNS FROM applications LIKE 'photo_path'")->num_rows > 0;

if ($passwordColumnExists && $photoColumnExists) {
    $stmt = $conn->prepare("INSERT INTO applications (
        student_id, last_name, given_name, ext_name, sex, birthdate,
        program_name, year_level, father_name, mother_name,
        family_monthly_income, income_range, province, municipality,
        street_barangay, zip_code, contact_number, email, password, photo_path,
        is_pwd, is_indigenous, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
} else if ($passwordColumnExists) {
    $stmt = $conn->prepare("INSERT INTO applications (
        student_id, last_name, given_name, ext_name, sex, birthdate,
        program_name, year_level, father_name, mother_name,
        family_monthly_income, income_range, province, municipality,
        street_barangay, zip_code, contact_number, email, password,
        is_pwd, is_indigenous, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
} else if ($photoColumnExists) {
    $stmt = $conn->prepare("INSERT INTO applications (
        student_id, last_name, given_name, ext_name, sex, birthdate,
        program_name, year_level, father_name, mother_name,
        family_monthly_income, income_range, province, municipality,
        street_barangay, zip_code, contact_number, email, photo_path,
        is_pwd, is_indigenous, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
} else {
    $stmt = $conn->prepare("INSERT INTO applications (
        student_id, last_name, given_name, ext_name, sex, birthdate,
        program_name, year_level, father_name, mother_name,
        family_monthly_income, income_range, province, municipality,
        street_barangay, zip_code, contact_number, email,
        is_pwd, is_indigenous, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
}

if (!$stmt) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to prepare statement: ' . $conn->error
    ]);
    $conn->close();
    exit;
}

// Convert birthdate to MySQL date format if provided
$birthdateFormatted = null;
if ($birthdate) {
    $birthdateFormatted = date('Y-m-d', strtotime($birthdate));
}

// Convert submittedAt to MySQL datetime format
$submittedAtFormatted = date('Y-m-d H:i:s', strtotime($submittedAt));

if ($passwordColumnExists && $photoColumnExists) {
    $stmt->bind_param("sssssssssssdssssssssssiiss",
        $studentId,
        $lastName,
        $givenName,
        $extName,
        $sex,
        $birthdateFormatted,
        $programName,
        $yearLevel,
        $fatherName,
        $motherName,
        $familyMonthlyIncome,
        $incomeRange,
        $province,
        $municipality,
        $streetBarangay,
        $zipCode,
        $contactNumber,
        $email,
        $password,
        $photoPath,
        $isPwd,
        $isIndigenous,
        $status,
        $submittedAtFormatted
    );
} else if ($passwordColumnExists) {
    $stmt->bind_param("sssssssssssdssssssssiiss",
        $studentId,
        $lastName,
        $givenName,
        $extName,
        $sex,
        $birthdateFormatted,
        $programName,
        $yearLevel,
        $fatherName,
        $motherName,
        $familyMonthlyIncome,
        $incomeRange,
        $province,
        $municipality,
        $streetBarangay,
        $zipCode,
        $contactNumber,
        $email,
        $password,
        $isPwd,
        $isIndigenous,
        $status,
        $submittedAtFormatted
    );
} else if ($photoColumnExists) {
    $stmt->bind_param("sssssssssssdssssssssiiss",
        $studentId,
        $lastName,
        $givenName,
        $extName,
        $sex,
        $birthdateFormatted,
        $programName,
        $yearLevel,
        $fatherName,
        $motherName,
        $familyMonthlyIncome,
        $incomeRange,
        $province,
        $municipality,
        $streetBarangay,
        $zipCode,
        $contactNumber,
        $email,
        $photoPath,
        $isPwd,
        $isIndigenous,
        $status,
        $submittedAtFormatted
    );
} else {
    $stmt->bind_param("sssssssssssdsssssssiiss",
        $studentId,
        $lastName,
        $givenName,
        $extName,
        $sex,
        $birthdateFormatted,
        $programName,
        $yearLevel,
        $fatherName,
        $motherName,
        $familyMonthlyIncome,
        $incomeRange,
        $province,
        $municipality,
        $streetBarangay,
        $zipCode,
        $contactNumber,
        $email,
        $isPwd,
        $isIndigenous,
        $status,
        $submittedAtFormatted
    );
}

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Application submitted successfully',
        'id' => $conn->insert_id
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save application: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>

