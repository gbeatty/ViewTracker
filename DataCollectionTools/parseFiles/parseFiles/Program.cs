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

            FileStream stream = File.Open("G:/skiView/Sensor_record_20141229_025126.xlsx", FileMode.Open, FileAccess.Read);
            IExcelDataReader excelReader = ExcelReaderFactory.CreateOpenXmlReader(stream);

            List<JulianDate> times = new List<JulianDate>();
            List<UnitQuaternion> orientations = new List<UnitQuaternion>();
            while (excelReader.Read())
            {
                double yaw = excelReader.GetDouble(0) - 90.0;
                double roll = excelReader.GetDouble(1);
                double pitch = (excelReader.GetDouble(2) + 90.0) * -1.0;
                string timeString = excelReader.GetString(3);

                DateTime time = DateTime.ParseExact(timeString, "yyyy-M-dd HH:mm:ss:fff", CultureInfo.InvariantCulture);


                times.Add(new JulianDate(time));
                orientations.Add(ToQuaternion(yaw, pitch, roll));
            }

            excelReader.Close();





            System.IO.TextWriter textWriter = System.IO.File.CreateText("G:/skiView/orientation.czml");
            CesiumOutputStream output = new CesiumOutputStream(textWriter);
            output.PrettyFormatting = true;
            output.WriteStartSequence();
              
            CesiumStreamWriter cesiumWriter = new CesiumStreamWriter();

            PacketCesiumWriter packetWriter = cesiumWriter.OpenPacket(output);
            packetWriter.WriteId("document");
            packetWriter.WriteVersion("1.0");
            packetWriter.WriteName("orientation");
            packetWriter.Close();

            packetWriter = cesiumWriter.OpenPacket(output);
            packetWriter.WriteId("CameraOrientation");
            packetWriter.WriteAvailability(times[0], times[times.Count - 1]);


            OrientationCesiumWriter orientationWriter = packetWriter.OpenOrientationProperty();
            orientationWriter.WriteInterpolationAlgorithm(CesiumInterpolationAlgorithm.Linear);
            orientationWriter.WriteInterpolationDegree(3);
            orientationWriter.WriteUnitQuaternion(times, orientations);

            orientationWriter.Close();
            packetWriter.Close();

            output.WriteEndSequence();
            textWriter.Close();

            
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
            return Math.PI / 180 * degrees;
        }
    }
}
