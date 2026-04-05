import cv2
import time
import requests

def main():
    # URL of our FastAPI upload endpoint
    url = "http://localhost:8000/api/v1/vision/upload-frame/"
    
    # Initialize the local webcam (0 is usually the default internal webcam)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open the local webcam.")
        return

    print(f"Starting webcam stream. Sending frames to {url} every 2 seconds...")
    print("Press Ctrl+C to stop.")
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab frame from webcam.")
                break
                
            # Encode frame directly to JPEG format
            success, encoded_image = cv2.imencode('.jpg', frame)
            if success:
                # Convert the image matrix to raw bytes
                image_bytes = encoded_image.tobytes()
                
                # Send an HTTP POST request using 'requests' multipart file upload
                files = {'file': ('frame.jpg', image_bytes, 'image/jpeg')}
                try:
                    response = requests.post(url, files=files)
                    print(f"Server response: {response.json()}")
                except requests.exceptions.RequestException as e:
                    print(f"Request failed: {e}")
                    
            # Wait for 2 seconds before grabbing the next frame
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\nStopping the webcam script manually...")
    finally:
        # Prevent resource leak by cleanly releasing the hardware
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
