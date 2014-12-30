using CesiumLanguageWriter;
using Excel;
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.Windows.Media.Media3D;

namespace parseFiles
{
    class Program
    {
        static void Main(string[] args)
        {
            // read orientation data
            FileStream stream = File.Open("D:/Cesium/ViewTracker/DataCollectionTools/Sensor_record_20141229_235105_AndroSensor.xlsx", FileMode.Open, FileAccess.Read);
            IExcelDataReader excelReader = ExcelReaderFactory.CreateOpenXmlReader(stream);

            List<JulianDate> orientationTimes = new List<JulianDate>();
            List<UnitQuaternion> orientations = new List<UnitQuaternion>();
            while (excelReader.Read())
            {
                double yaw = excelReader.GetDouble(0) * -1.0;
                double roll = excelReader.GetDouble(1);
                double pitch = (excelReader.GetDouble(2) + 90.0) * -1.0;
                string timeString = excelReader.GetString(3);

                NormalizeAngle(ref yaw);
                NormalizeAngle(ref pitch);
                NormalizeAngle(ref roll);

                DateTime time = DateTime.ParseExact(timeString, "yyyy-M-dd HH:mm:ss:fff", CultureInfo.InvariantCulture);
                time = time.ToUniversalTime();

                orientationTimes.Add(new JulianDate(time));
                orientations.Add(ToQuaternionNew(yaw, pitch, roll));
            }

            excelReader.Close();



            // read gps data
            stream = File.Open("D:/Cesium/ViewTracker/DataCollectionTools/TestTrack.xlsx", FileMode.Open, FileAccess.Read);
            excelReader = ExcelReaderFactory.CreateOpenXmlReader(stream);
            List<Cartographic> gpsPositions = new List<Cartographic>();
            List<JulianDate> gpsTimes = new List<JulianDate>();
            while (excelReader.Read())
            {
                double latitude = deg2Rad(excelReader.GetDouble(0));
                double longitude = deg2Rad(excelReader.GetDouble(1));
                double altitude = excelReader.GetDouble(2);
                string timeString = excelReader.GetString(3);

                DateTime time = DateTime.Parse(timeString, CultureInfo.InvariantCulture);
                time = time.ToUniversalTime();

                gpsTimes.Add(new JulianDate(time));
                gpsPositions.Add(new Cartographic(longitude, latitude, altitude));
            }

            excelReader.Close();



            System.IO.TextWriter textWriter = System.IO.File.CreateText("D:/Cesium/ViewTracker/Gallery/TestOrientation.czml");
            CesiumOutputStream output = new CesiumOutputStream(textWriter);
            output.PrettyFormatting = true;
            output.WriteStartSequence();
              
            CesiumStreamWriter cesiumWriter = new CesiumStreamWriter();

            PacketCesiumWriter packetWriter = cesiumWriter.OpenPacket(output);
            packetWriter.WriteId("document");
            packetWriter.WriteVersion("1.0");
            packetWriter.WriteName("orientation");
            packetWriter.Close();

            // write orientation
            packetWriter = cesiumWriter.OpenPacket(output);
            packetWriter.WriteId("CameraOrientation");
            packetWriter.WriteAvailability(orientationTimes[0], orientationTimes[orientationTimes.Count - 1]);

            OrientationCesiumWriter orientationWriter = packetWriter.OpenOrientationProperty();
            orientationWriter.WriteInterpolationAlgorithm(CesiumInterpolationAlgorithm.Linear);
            orientationWriter.WriteInterpolationDegree(5);
            orientationWriter.WriteUnitQuaternion(orientationTimes, orientations);

            orientationWriter.Close();
            packetWriter.Close();



            // write gps positions as a path
            packetWriter = cesiumWriter.OpenPacket(output);
            packetWriter.WriteId("CameraPosition");
            packetWriter.WriteAvailability(gpsTimes[0], gpsTimes[gpsTimes.Count - 1]);

            PathCesiumWriter pathWriter = packetWriter.OpenPathProperty();
            pathWriter.WriteWidthProperty(5.0);
            pathWriter.Close();

            packetWriter.WritePositionPropertyCartographicRadians(gpsTimes, gpsPositions);

            packetWriter.Close();

            output.WriteEndSequence();
            textWriter.Close();

            
        }

        public static void NormalizeAngle(ref double angleDegrees)
        {
            if (angleDegrees > 180.0)
            {
                angleDegrees -= 360.0;
            }

            else if (angleDegrees < -180.0)
            {
                angleDegrees += 360.0;
            }
        }

        public static UnitQuaternion ToQuaternionNew(double yaw, double pitch, double roll)
        {
            yaw = deg2Rad(yaw);
            pitch = deg2Rad(pitch);
            roll = deg2Rad(roll);

            double c1 = Math.Cos(yaw / 2);
            double s1 = Math.Sin(yaw / 2);
            double c2 = Math.Cos(pitch / 2);
            double s2 = Math.Sin(pitch / 2);
            double c3 = Math.Cos(roll / 2);
            double s3 = Math.Sin(roll / 2);

            double w = (c1 * c2 * c3) - (s1 * s2 * s3);
            double x = (c1 * c2 * s3) + (s1 * s2 * c3);
            double z = (s1 * c2 * c3) + (c1 * s2 * s3);
            double y = (c1 * s2 * c3) - (s1 * c2 * s3);

            return new UnitQuaternion(w, x, y, z);
        }

        public static UnitQuaternion ToQuaternion(double yaw, double pitch, double roll)
        {
            yaw = deg2Rad(yaw);
            pitch = deg2Rad(pitch);
            roll = deg2Rad(roll);
            double rollOver2 = roll * 0.5;
            double sinRollOver2 = Math.Sin(rollOver2);
            double cosRollOver2 = Math.Cos(rollOver2);
            double pitchOver2 = pitch * 0.5f;
            double sinPitchOver2 = Math.Sin((double)pitchOver2);
            double cosPitchOver2 = Math.Cos((double)pitchOver2);
            double yawOver2 = yaw * 0.5;
            double sinYawOver2 = Math.Sin(yawOver2);
            double cosYawOver2 = Math.Cos(yawOver2);
            
            double W = cosYawOver2 * cosPitchOver2 * cosRollOver2 + sinYawOver2 * sinPitchOver2 * sinRollOver2;
            double X = cosYawOver2 * sinPitchOver2 * cosRollOver2 + sinYawOver2 * cosPitchOver2 * sinRollOver2;
            double Y = sinYawOver2 * cosPitchOver2 * cosRollOver2 - cosYawOver2 * sinPitchOver2 * sinRollOver2;
            double Z = cosYawOver2 * cosPitchOver2 * sinRollOver2 - sinYawOver2 * sinPitchOver2 * cosRollOver2;

            return new UnitQuaternion(W, X, Y, Z);
        }

        public static double deg2Rad(double degrees)
        {
            return Math.PI / 180.0 * degrees;
        }
    }
}
