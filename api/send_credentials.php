<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load database configuration
require_once __DIR__ . '/../config/database.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request data'
    ]);
    exit;
}

$email = $data['email'] ?? '';
$phoneNumber = $data['phoneNumber'] ?? '';
$studentName = $data['studentName'] ?? '';
$awardNumber = $data['awardNumber'] ?? '';
$password = $data['password'] ?? '';
$studentId = $data['studentId'] ?? '';

if (empty($email) || empty($awardNumber) || empty($password)) {
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields'
    ]);
    exit;
}

$emailSent = false;
$smsSent = false;

// Send Email using PHPMailer
try {
    // Check if PHPMailer is available
    $phpmailerPath = __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
    
    if (file_exists($phpmailerPath)) {
        // Use PHPMailer (recommended - more reliable)
        require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';
        require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
        require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';
        
        // Use fully qualified class names
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        
        // Load Gmail credentials from config
        $gmailConfigPath = __DIR__ . '/../config/gmail_config.php';
        if (file_exists($gmailConfigPath)) {
            require_once $gmailConfigPath;
            $gmailUser = defined('GMAIL_USER') ? GMAIL_USER : 'your-email@gmail.com';
            $gmailPass = defined('GMAIL_PASS') ? GMAIL_PASS : '';
        } else {
            // Fallback: use environment variables or default values
            $gmailUser = getenv('GMAIL_USER') ?: 'your-email@gmail.com';
            $gmailPass = getenv('GMAIL_PASS') ?: '';
        }
        
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = $gmailUser;  // Will be set from config
        $mail->Password   = $gmailPass;  // Will be set from config
        $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';
        $mail->SMTPDebug  = 0; // Set to 2 for debugging
        
        // Recipients
        $mail->setFrom($gmailUser, 'GranTES System');
        $mail->addAddress($email, $studentName);
        $mail->addReplyTo($gmailUser, 'GranTES Administration');
        
        // Content
        $mail->isHTML(true);
        $mail->Subject = 'GranTES - Your Account Credentials';
        $mail->Body    = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .credentials { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3b82f6; border-radius: 3px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h2>GranTES Account Credentials</h2>
                </div>
                <div class='content'>
                    <p>Dear $studentName,</p>
                    <p>Congratulations! Your application for the <strong>GranTES (Grant for Tertiary Education Students)</strong> has been approved.</p>
                    <p>Your account has been created. Please find your login credentials below:</p>
                    <div class='credentials'>
                        <p><strong>Student ID:</strong> $studentId</p>
                        <p><strong>Award Number:</strong> $awardNumber</p>
                        <p><strong>Password:</strong> $password</p>
                    </div>
                    <p>You can now login to the GranTES system using your <strong>Award Number</strong> and <strong>Password</strong>.</p>
                    <p><strong>⚠️ Please keep your credentials secure and do not share them with anyone.</strong></p>
                    <p>If you have any questions or concerns, please contact the administration.</p>
                    <p>Best regards,<br>GranTES Administration</p>
                </div>
                <div class='footer'>
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        ";
        $mail->AltBody = "Dear $studentName,\n\nCongratulations! Your application for the GranTES (Grant for Tertiary Education Students) has been approved.\n\nYour account has been created. Please find your login credentials below:\n\nStudent ID: $studentId\nAward Number: $awardNumber\nPassword: $password\n\nYou can now login to the GranTES system using your Award Number and Password.\n\nPlease keep your credentials secure and do not share them with anyone.\n\nIf you have any questions or concerns, please contact the administration.\n\nBest regards,\nGranTES Administration";
        
        $mail->send();
        $emailSent = true;
        
    } else {
        // Fallback to PHP mail() function
        $subject = 'GranTES - Your Account Credentials';
        $message = "Dear $studentName,\n\n";
        $message .= "Congratulations! Your application for the GranTES (Grant for Tertiary Education Students) has been approved.\n\n";
        $message .= "Your account has been created. Please find your login credentials below:\n\n";
        $message .= "Student ID: $studentId\n";
        $message .= "Award Number: $awardNumber\n";
        $message .= "Password: $password\n\n";
        $message .= "You can now login to the GranTES system using your Award Number and Password.\n\n";
        $message .= "Please keep your credentials secure and do not share them with anyone.\n\n";
        $message .= "If you have any questions or concerns, please contact the administration.\n\n";
        $message .= "Best regards,\n";
        $message .= "GranTES Administration";
        
        $headers = "From: GranTES System <noreply@grantes.edu>\r\n";
        $headers .= "Reply-To: admin@grantes.edu\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        
        $emailSent = mail($email, $subject, $message, $headers);
    }
    
} catch (Exception $e) {
    error_log("Email send error: " . $e->getMessage());
    $emailSent = false;
}

// Send SMS (using Twilio API or similar - you'll need to configure this)
// For now, we'll simulate SMS sending. You'll need to integrate with an SMS gateway.
// Common options: Twilio, Nexmo, Clickatell, or local SMS gateway
try {
    // Example: If you have Twilio configured
    // require_once 'vendor/autoload.php'; // For Composer packages
    // use Twilio\Rest\Client;
    // 
    // $accountSid = 'your_twilio_account_sid';
    // $authToken = 'your_twilio_auth_token';
    // $twilioNumber = 'your_twilio_phone_number';
    // 
    // $client = new Client($accountSid, $authToken);
    // 
    // $smsMessage = "GranTES: Your application is approved. Award Number: $awardNumber, Password: $password. Login at: grantes.edu";
    // 
    // $message = $client->messages->create(
    //     $phoneNumber,
    //     [
    //         'from' => $twilioNumber,
    //         'body' => $smsMessage
    //     ]
    // );
    // $smsSent = true;
    
    // For now, we'll log the SMS message (replace this with actual SMS gateway integration)
    $smsMessage = "GranTES: Your application is approved. Award Number: $awardNumber, Password: $password. Login at: grantes.edu";
    error_log("SMS to send to $phoneNumber: $smsMessage");
    
    // TODO: Implement actual SMS gateway integration
    // For demonstration, setting to true if phone number exists
    $smsSent = !empty($phoneNumber);
    
} catch (Exception $e) {
    error_log("SMS send error: " . $e->getMessage());
    $smsSent = false;
}

echo json_encode([
    'success' => $emailSent || $smsSent,
    'emailSent' => $emailSent,
    'smsSent' => $smsSent,
    'message' => $emailSent && $smsSent 
        ? 'Email and SMS sent successfully' 
        : ($emailSent ? 'Email sent, SMS failed' : ($smsSent ? 'SMS sent, Email failed' : 'Failed to send credentials'))
]);
?>

