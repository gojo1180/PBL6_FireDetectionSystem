import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Ensure backend directory is in python search path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environmental variables explicitly from backend/.env so tests can run from any directory
from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

from services.fusion_engine import LateFusionService
from core.mqtt_client import on_message

class TestLateFusionLogic(unittest.TestCase):
    """
    White-box testing suite for LateFusionService logic.
    Focuses on path/branch coverage of evaluate_late_fusion.
    """
    def setUp(self):
        # We patch YOLO loading to prevent long startup times or missing file errors
        with patch('services.fusion_engine.YOLO') as mock_yolo:
            self.service = LateFusionService()

    def test_evaluate_late_fusion_safe_branch(self):
        """
        LF-01: Both sensors and vision are safe.
        Expected outcome: 'SAFE'
        """
        self.service.latest_sensor_anomaly = False
        self.service.latest_vision_conf = 0.0
        self.assertEqual(self.service.evaluate_late_fusion(), 'SAFE')

    def test_evaluate_late_fusion_sensor_alert_branch(self):
        """
        LF-02: Sensor detects anomaly, vision is safe.
        Expected outcome: 'SENSOR_ALERT'
        """
        self.service.latest_sensor_anomaly = True
        self.service.latest_vision_conf = 0.0
        self.assertEqual(self.service.evaluate_late_fusion(), 'SENSOR_ALERT')

    def test_evaluate_late_fusion_cctv_alert_branch(self):
        """
        LF-03: Sensor is safe, vision detects threat (>0.45).
        Expected outcome: 'CCTV_ALERT'
        """
        self.service.latest_sensor_anomaly = False
        self.service.latest_vision_conf = 0.8
        self.assertEqual(self.service.evaluate_late_fusion(), 'CCTV_ALERT')

    def test_evaluate_late_fusion_fire_danger_branch(self):
        """
        LF-04: Both sensor and vision detect threat.
        Expected outcome: 'FIRE_DANGER'
        """
        self.service.latest_sensor_anomaly = True
        self.service.latest_vision_conf = 0.8
        self.assertEqual(self.service.evaluate_late_fusion(), 'FIRE_DANGER')


class TestMQTTPayloadExceptionHandling(unittest.TestCase):
    """
    White-box testing suite for MQTT payload parsing.
    Focuses on exception boundaries and fault tolerance.
    """
    @patch('core.database.supabase')
    @patch('services.fusion_engine.fusion_service')
    def test_on_message_valid_payload(self, mock_fusion_service, mock_supabase):
        """
        MQ-01: Valid payload containing valid telemetry.
        """
        mock_msg = MagicMock()
        mock_msg.payload = b'{"device_id": "esp32-node-1", "co_level": 0.12, "lpg_level": 0.05, "smoke_detected": false, "temperature": 29.5}'
        
        mock_fusion_service.process_sensor_data.return_value = False
        mock_fusion_service.update_sensor.return_value = 'SAFE'
        
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = MagicMock(data=[])

        # Run method
        on_message(None, None, mock_msg)
        
        # Verify it passed sensor logs to database
        mock_supabase.table.assert_any_call("sensor_logs")
        mock_table.insert.assert_called_once()

    @patch('core.database.supabase')
    @patch('services.fusion_engine.fusion_service')
    def test_on_message_empty_or_corrupted_payload(self, mock_fusion_service, mock_supabase):
        """
        MQ-02: Missing fields (empty object) handles default values or KeyError safely.
        """
        mock_msg = MagicMock()
        mock_msg.payload = b'{}'
        
        mock_fusion_service.process_sensor_data.return_value = False
        mock_fusion_service.update_sensor.return_value = 'SAFE'
        
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = MagicMock(data=[])

        # Executing should not raise KeyError
        try:
            on_message(None, None, mock_msg)
        except Exception as e:
            self.fail(f"on_message raised an unexpected exception: {e}")
            
        mock_supabase.table.assert_any_call("sensor_logs")

    @patch('core.database.supabase')
    @patch('services.fusion_engine.fusion_service')
    def test_on_message_invalid_json_format(self, mock_fusion_service, mock_supabase):
        """
        MQ-03: Completely non-JSON or raw text data does not crash the system.
        """
        mock_msg = MagicMock()
        mock_msg.payload = b'raw_unstructured_string_123'
        
        # Execute should return early and not throw/crash
        try:
            on_message(None, None, mock_msg)
        except Exception as e:
            self.fail(f"on_message crashed on invalid JSON payload: {e}")
            
        # Verify it skipped database logic
        mock_supabase.table.assert_not_called()

class TestYOLOLoopTesting(unittest.TestCase):
    """
    White-box testing suite focusing on Loop Testing for the YOLO vision loop.
    Tests boundary conditions of loops: 0 iterations, 1 iteration, and multiple iterations.
    """
    def setUp(self):
        with patch('services.fusion_engine.YOLO') as mock_yolo:
            self.service = LateFusionService()
            self.service.yolo_model = mock_yolo

    @patch('services.fusion_engine.Image.open')
    def test_loop_zero_iterations(self, mock_image_open):
        # 0 iterations of results loop
        self.service.yolo_model.track.return_value = []
        
        res = self.service.process_vision_data(b'dummy_image_bytes')
        self.assertEqual(res["fire_confidence"], 0.0)
        self.assertEqual(res["smoke_confidence"], 0.0)

    @patch('services.fusion_engine.Image.open')
    def test_loop_one_iteration_zero_boxes(self, mock_image_open):
        # 1 iteration of results loop, 0 iterations of boxes loop
        mock_result = MagicMock()
        mock_result.boxes = []
        mock_result.plot.return_value = "annotated_frame_mock"
        self.service.yolo_model.track.return_value = [mock_result]
        
        res = self.service.process_vision_data(b'dummy_image_bytes')
        self.assertEqual(res["fire_confidence"], 0.0)
        self.assertEqual(res["annotated_frame"], "annotated_frame_mock")

    @patch('services.fusion_engine.Image.open')
    def test_loop_multiple_iterations_and_boxes(self, mock_image_open):
        # Multiple iterations of loops with different classes
        mock_box_fire = MagicMock()
        mock_box_fire.cls = [0]
        mock_box_fire.conf = [0.85]
        mock_box_fire.id = [12]
        
        mock_box_smoke = MagicMock()
        mock_box_smoke.cls = [1]
        mock_box_smoke.conf = [0.60]
        mock_box_smoke.id = None
        
        mock_result = MagicMock()
        mock_result.boxes = [mock_box_fire, mock_box_smoke]
        mock_result.plot.return_value = "annotated_frame_mock"
        
        self.service.yolo_model.names = {0: "fire", 1: "smoke"}
        self.service.yolo_model.track.return_value = [mock_result]
        
        res = self.service.process_vision_data(b'dummy_image_bytes')
        self.assertEqual(res["fire_confidence"], 0.85)
        self.assertEqual(res["smoke_confidence"], 0.60)

if __name__ == '__main__':
    unittest.main()
