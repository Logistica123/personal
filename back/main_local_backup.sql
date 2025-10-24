/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.13-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: main_local
-- ------------------------------------------------------
-- Server version	10.11.13-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `archivos`
--

DROP TABLE IF EXISTS `archivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `archivos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` bigint(20) unsigned NOT NULL,
  `tipo_archivo_id` bigint(20) unsigned DEFAULT NULL,
  `carpeta` varchar(255) NOT NULL,
  `ruta` varchar(255) NOT NULL,
  `download_url` text DEFAULT NULL,
  `disk` varchar(255) NOT NULL DEFAULT 'public',
  `nombre_original` text DEFAULT NULL,
  `mime` varchar(255) DEFAULT NULL,
  `size` bigint(20) unsigned DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `archivos_persona_id_foreign` (`persona_id`),
  KEY `archivos_tipo_archivo_id_foreign` (`tipo_archivo_id`),
  CONSTRAINT `archivos_persona_id_foreign` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `archivos_tipo_archivo_id_foreign` FOREIGN KEY (`tipo_archivo_id`) REFERENCES `fyle_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archivos`
--

LOCK TABLES `archivos` WRITE;
/*!40000 ALTER TABLE `archivos` DISABLE KEYS */;
INSERT INTO `archivos` VALUES
(1,1,1,'documentos','public/documentos/f_68c834804c9d71.88351856.png','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68c834804c9d71.88351856.png','supabase','Ciudades donde trabajamos 5.png','image/png',397661,NULL,'2025-09-15 15:45:05','2025-09-15 15:45:05',NULL),
(2,1,1,'documentos','public/documentos/f_68c834887d6b76.79262309.png','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68c834887d6b76.79262309.png','supabase','Ciudades donde trabajamos 4.png','image/png',443260,NULL,'2025-09-15 15:45:13','2025-09-15 15:45:13',NULL),
(3,1,2,'documentos','public/documentos/f_68c83492269a04.76805014.jpeg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68c83492269a04.76805014.jpeg','supabase','Ciudades donde trabajamos 3.jpeg','image/jpeg',171428,NULL,'2025-09-15 15:45:23','2025-09-15 15:45:23',NULL),
(4,2,3,'documentos','public/documentos/f_68c85b5acfb093.99882408.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68c85b5acfb093.99882408.pdf','supabase','WhatsApp+Image+2025-09-15+at+9.12.33+AM.pdf','application/pdf',49493,NULL,'2025-09-15 18:30:51','2025-09-15 18:30:51',NULL),
(5,2,5,'documentos','public/documentos/f_68c85b82091634.40715560.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68c85b82091634.40715560.pdf','supabase','desch.pdf','application/pdf',1268342,NULL,'2025-09-15 18:31:31','2025-09-15 18:31:31',NULL),
(6,2,1,'documentos','public/documentos/f_68c85bb2ac47c4.21081358.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68c85bb2ac47c4.21081358.pdf','supabase','POLIZA (3).pdf','application/pdf',1502487,NULL,'2025-09-15 18:32:20','2025-09-15 18:32:20',NULL),
(7,5,7,'documentos','public/documentos/f_68cdaf2ce5c3d7.96159744.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdaf2ce5c3d7.96159744.jpg','supabase','CONTRATO H4.jpg','image/jpeg',153861,NULL,'2025-09-19 19:29:50','2025-09-19 19:29:50',NULL),
(8,5,7,'documentos','public/documentos/f_68cdaf2f2864a2.62384396.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdaf2f2864a2.62384396.jpg','supabase','CONTRATO H2.jpg','image/jpeg',152331,NULL,'2025-09-19 19:29:52','2025-09-19 19:29:52',NULL),
(9,5,7,'documentos','public/documentos/f_68cdaf31d52fd0.07879992.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdaf31d52fd0.07879992.jpg','supabase','CONTRATO H1.jpg','image/jpeg',191386,NULL,'2025-09-19 19:29:54','2025-09-19 19:29:54',NULL),
(10,5,7,'documentos','public/documentos/f_68cdaf334b7696.19221742.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdaf334b7696.19221742.jpg','supabase','CONTRATO H3.jpg','image/jpeg',113370,NULL,'2025-09-19 19:29:55','2025-09-19 19:29:55',NULL),
(11,5,6,'documentos','public/documentos/f_68cdaf6cdbd251.43551213.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdaf6cdbd251.43551213.pdf','supabase','TITULO KANGOO NOEMI.pdf','application/pdf',23245,NULL,'2025-09-19 19:30:53','2025-09-19 19:30:53',NULL),
(12,5,5,'documentos','public/documentos/f_68cdb3748702d7.21772011.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdb3748702d7.21772011.jpg','supabase','CEDULA DORSO.jpg','image/jpeg',210582,NULL,'2025-09-19 19:48:05','2025-09-19 19:48:05',NULL),
(13,5,5,'documentos','public/documentos/f_68cdb37775cbf0.78438789.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cdb37775cbf0.78438789.jpg','supabase','CEDULA FRENTE.jpg','image/jpeg',177858,NULL,'2025-09-19 19:48:08','2025-09-19 19:48:08',NULL),
(14,5,1,'documentos','public/documentos/f_68cf3bd920bcf5.37162416.jpeg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cf3bd920bcf5.37162416.jpeg','supabase','Captura de pantalla_18-12-2024_181054_localhost(1).jpeg','image/jpeg',139404,NULL,'2025-09-20 23:42:21','2025-09-20 23:42:21',NULL),
(15,3,1,'reclamos','public/documentos/f_68cff773d8e760.78512984.jpeg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cff773d8e760.78512984.jpeg','supabase','Captura de pantalla_18-12-2024_181054_localhost.jpeg','image/jpeg',139404,NULL,'2025-09-21 13:02:47','2025-09-21 13:02:47',NULL),
(16,3,1,'reclamos','public/documentos/f_68cff7810142d1.30942912.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68cff7810142d1.30942912.jpg','supabase','BMO wallpaper.jpg','image/jpeg',61979,NULL,'2025-09-21 13:02:58','2025-09-21 13:02:58',NULL),
(17,3,1,'reclamos','public/documentos/f_68d05b3dc71c64.57407849.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d05b3dc71c64.57407849.jpg','supabase','emf.jpg','image/jpeg',117164,NULL,'2025-09-21 20:08:32','2025-09-21 20:08:32',NULL),
(18,5,4,'documentos','public/documentos/f_68d1495d4a6b02.32235668.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d1495d4a6b02.32235668.jpg','supabase','LICENCIA FRENTE.jpg','image/jpeg',116239,NULL,'2025-09-22 13:04:30','2025-09-22 13:04:30',NULL),
(19,5,4,'documentos','public/documentos/f_68d149603e3f79.09352760.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d149603e3f79.09352760.jpg','supabase','LICENCIA DORSO.jpg','image/jpeg',132606,NULL,'2025-09-22 13:04:33','2025-09-22 13:04:33',NULL),
(20,5,2,'documentos','public/documentos/f_68d149e81b8d23.41308964.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d149e81b8d23.41308964.jpg','supabase','DNI FRENTE.jpg','image/jpeg',80611,NULL,'2025-09-22 13:06:48','2025-09-22 13:06:48',NULL),
(21,5,2,'documentos','public/documentos/f_68d149e9f2a9e6.10917155.jpg','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d149e9f2a9e6.10917155.jpg','supabase','DNI DORSO.jpg','image/jpeg',72007,NULL,'2025-09-22 13:06:50','2025-09-22 13:06:50',NULL),
(22,5,1,'documentos','public/documentos/f_68d14a8846b7d9.48773283.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d14a8846b7d9.48773283.pdf','supabase','POLIZA_AH451HY[23774]_250725_152507.pdf','application/pdf',319036,NULL,'2025-09-22 13:09:29','2025-09-22 13:09:29',NULL),
(23,14,1,'reclamos','public/documentos/f_68d16a43028621.59204660.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d16a43028621.59204660.pdf','supabase','antecedentes penales.pdf','application/pdf',305852,NULL,'2025-09-22 15:24:52','2025-09-22 15:24:52',NULL),
(24,14,1,'reclamos','public/documentos/f_68d182f584a914.05086766.docx','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d182f584a914.05086766.docx','supabase','Sprints Core Talent.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',9895,NULL,'2025-09-22 17:10:14','2025-09-22 17:10:14',NULL),
(25,8,1,'reclamos','public/documentos/f_68d188f629d2e0.46372772.png','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d188f629d2e0.46372772.png','supabase','ChatGPT Image 22 sept 2025, 08_24_27 a.m..png','image/png',1769959,NULL,'2025-09-22 17:35:51','2025-09-23 13:38:05','2025-09-23 13:38:05'),
(26,14,1,'reclamos','public/documentos/f_68d18c3571f615.54052388.png','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d18c3571f615.54052388.png','supabase','logo BSV 200px.png','image/png',3676,NULL,'2025-09-22 17:49:42','2025-09-22 17:49:42',NULL),
(27,9,1,'reclamos','public/documentos/f_68d19712ea22e9.51296853.pdf','https://notbvdymlxpwrzecgptp.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d19712ea22e9.51296853.pdf','supabase','antecedentes penales.pdf','application/pdf',305852,NULL,'2025-09-22 18:36:04','2025-09-23 13:39:49','2025-09-23 13:39:49'),
(28,27,1,'reclamos','public/documentos/f_68d7b3c0b08db7.19403370.jpeg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d7b3c0b08db7.19403370.jpeg','supabase','Captura de pantalla_18-12-2024_181054_localhost(1).jpeg','image/jpeg',139404,NULL,'2025-09-27 09:52:01','2025-09-27 09:52:01',NULL),
(29,76,1,'reclamos','public/documentos/f_68d9ec07e9d449.88529229.pdf','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d9ec07e9d449.88529229.pdf','supabase','db-diagrams[1].pdf','application/pdf',763566,NULL,'2025-09-29 02:16:41','2025-09-29 02:16:41',NULL),
(30,76,1,'reclamos','public/documentos/f_68d9ec24526f65.51910707.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d9ec24526f65.51910707.docx','supabase','2da Devolución VOI - 30_07[1].docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',13903,NULL,'2025-09-29 02:17:08','2025-09-29 02:17:08',NULL),
(31,76,1,'reclamos','public/documentos/f_68d9ec30243792.67044099.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d9ec30243792.67044099.png','supabase','1200px-Houston_Astros_logo.svg.png','image/png',180843,NULL,'2025-09-29 02:17:20','2025-09-29 02:17:20',NULL),
(32,76,1,'reclamos','public/documentos/f_68d9ed91a7b2f8.81365039.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68d9ed91a7b2f8.81365039.png','supabase','1200px-Houston_Astros_logo.svg.png','image/png',180843,NULL,'2025-09-29 02:23:14','2025-09-29 02:23:14',NULL),
(33,76,1,'reclamos','public/documentos/f_68dacb8394aed1.03159487.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dacb8394aed1.03159487.png','supabase','Alegría.png','image/png',144353,NULL,'2025-09-29 18:10:12','2025-09-29 18:10:12',NULL),
(34,76,1,'reclamos','public/documentos/f_68dacb96b81102.72781300.pdf','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dacb96b81102.72781300.pdf','supabase','Cronograma Proyecto Bauerberg-Klein[1].pdf','application/pdf',224094,NULL,'2025-09-29 18:10:31','2025-09-29 18:10:31',NULL),
(35,76,1,'reclamos','public/documentos/f_68dacbab03e742.72641702.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dacbab03e742.72641702.docx','supabase','Hitos del proyecto Bauerberg.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',18394,NULL,'2025-09-29 18:10:51','2025-09-29 18:10:51',NULL),
(36,109,1,'reclamos','public/documentos/f_68dc1e5915d8b1.92683677.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dc1e5915d8b1.92683677.jpg','supabase','30deAgosto.jpg','image/jpeg',92703,NULL,'2025-09-30 18:15:53','2025-09-30 18:15:53',NULL),
(37,77,1,'reclamos','public/documentos/f_68dd3a34bf0cc1.29135242.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd3a34bf0cc1.29135242.jpg','supabase','SotoOrlando23deJulio2.jpg','image/jpeg',126079,NULL,'2025-10-01 14:27:01','2025-10-01 14:27:01',NULL),
(38,77,1,'reclamos','public/documentos/f_68dd3a3694fc55.08296593.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd3a3694fc55.08296593.jpg','supabase','SotoOrlando23deJulio1.jpg','image/jpeg',118629,NULL,'2025-10-01 14:27:03','2025-10-01 14:27:03',NULL),
(39,117,1,'reclamos','public/documentos/f_68dd405ed837a1.09781554.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd405ed837a1.09781554.jpg','supabase','BenegasAgustin3deJulio.jpg','image/jpeg',28113,NULL,'2025-10-01 14:53:19','2025-10-01 14:53:19',NULL),
(40,84,1,'reclamos','public/documentos/f_68dd6637aaf0a6.94415528.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd6637aaf0a6.94415528.png','supabase','ExceldeControl.png','image/png',45524,NULL,'2025-10-01 17:34:48','2025-10-01 17:34:48',NULL),
(41,84,1,'reclamos','public/documentos/f_68dd66398b56f0.84173802.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd66398b56f0.84173802.png','supabase','30deMayo.png','image/png',454504,NULL,'2025-10-01 17:34:50','2025-10-01 17:34:50',NULL),
(42,84,1,'reclamos','public/documentos/f_68dd663aaac523.87186175.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd663aaac523.87186175.png','supabase','27y28deMayo.png','image/png',422424,NULL,'2025-10-01 17:34:51','2025-10-01 17:34:51',NULL),
(43,84,1,'reclamos','public/documentos/f_68dd663b78d2c3.90989133.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd663b78d2c3.90989133.png','supabase','23deMayo.png','image/png',444627,NULL,'2025-10-01 17:34:52','2025-10-01 17:34:52',NULL),
(44,84,1,'reclamos','public/documentos/f_68dd663c7e09f3.65432293.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd663c7e09f3.65432293.png','supabase','22deMayo.png','image/png',415907,NULL,'2025-10-01 17:34:53','2025-10-01 17:34:53',NULL),
(45,84,1,'reclamos','public/documentos/f_68dd663d80cd31.90092672.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd663d80cd31.90092672.png','supabase','21deMayo.png','image/png',422483,NULL,'2025-10-01 17:34:53','2025-10-01 17:34:53',NULL),
(46,84,1,'reclamos','public/documentos/f_68dd663e39b692.66545192.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd663e39b692.66545192.png','supabase','19y20deMayo.png','image/png',415423,NULL,'2025-10-01 17:34:54','2025-10-01 17:34:54',NULL),
(47,84,1,'reclamos','public/documentos/f_68dd663f2e0df2.10597821.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dd663f2e0df2.10597821.png','supabase','16deMayo.png','image/png',321112,NULL,'2025-10-01 17:34:55','2025-10-01 17:34:55',NULL),
(48,108,1,'reclamos','public/documentos/f_68de68ba285cb6.53430002.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68de68ba285cb6.53430002.jpg','supabase','abdf8400-6a79-4cfa-ae44-d2b52d841c51.jpg','image/jpeg',163970,NULL,'2025-10-02 11:57:46','2025-10-02 11:57:46',NULL),
(49,108,1,'reclamos','public/documentos/f_68de68bc532dc5.58997787.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68de68bc532dc5.58997787.jpg','supabase','c3d0fa34-09c1-4623-a78e-ff0caeca4ce8.jpg','image/jpeg',167711,NULL,'2025-10-02 11:57:48','2025-10-02 11:57:48',NULL),
(50,108,1,'reclamos','public/documentos/f_68de68bde83724.20040927.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68de68bde83724.20040927.jpg','supabase','ef1ba942-cc92-4819-a66d-20498d641d59.jpg','image/jpeg',175074,NULL,'2025-10-02 11:57:50','2025-10-02 11:57:50',NULL),
(51,108,1,'reclamos','public/documentos/f_68de68bf6b69b9.87923463.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68de68bf6b69b9.87923463.jpg','supabase','2d54be59-8f02-4605-8961-b8748f95b926.jpg','image/jpeg',178941,NULL,'2025-10-02 11:57:51','2025-10-02 11:57:51',NULL),
(52,96,1,'reclamos','public/documentos/f_68dec990104274.98582390.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec990104274.98582390.jpg','supabase','13deAgosto.jpg','image/jpeg',30810,NULL,'2025-10-02 18:50:56','2025-10-02 18:50:56',NULL),
(53,96,1,'reclamos','public/documentos/f_68dec9910b5f98.40732555.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec9910b5f98.40732555.jpg','supabase','11deAgosto.jpg','image/jpeg',21339,NULL,'2025-10-02 18:50:57','2025-10-02 18:50:57',NULL),
(54,96,1,'reclamos','public/documentos/f_68dec991befee2.74474416.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec991befee2.74474416.jpg','supabase','8deAgosto.jpg','image/jpeg',26126,NULL,'2025-10-02 18:50:58','2025-10-02 18:50:58',NULL),
(55,96,1,'reclamos','public/documentos/f_68dec992711aa9.00475197.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec992711aa9.00475197.jpg','supabase','7deAgosto.jpg','image/jpeg',24976,NULL,'2025-10-02 18:50:58','2025-10-02 18:50:58',NULL),
(56,96,1,'reclamos','public/documentos/f_68dec993247181.06606625.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec993247181.06606625.jpg','supabase','5deAgosto.jpg','image/jpeg',37198,NULL,'2025-10-02 18:50:59','2025-10-02 18:50:59',NULL),
(57,96,1,'reclamos','public/documentos/f_68dec993ca4cc0.34819499.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec993ca4cc0.34819499.jpg','supabase','12deAgosto.jpg','image/jpeg',37198,NULL,'2025-10-02 18:51:00','2025-10-02 18:51:00',NULL),
(58,96,1,'reclamos','public/documentos/f_68dec99485a043.01921678.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dec99485a043.01921678.jpg','supabase','4deAgosto.jpg','image/jpeg',43991,NULL,'2025-10-02 18:51:00','2025-10-02 18:51:00',NULL),
(59,50,1,'reclamos','public/documentos/f_68dece654b4442.12826922.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68dece654b4442.12826922.jpg','supabase','CaceresArielReclamo.jpg','image/jpeg',188673,NULL,'2025-10-02 19:11:34','2025-10-02 19:11:34',NULL),
(60,150,1,'reclamos','public/documentos/f_68e08da4178d00.88093413.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e08da4178d00.88093413.docx','supabase','AMD CON SPRINT.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',16194,NULL,'2025-10-04 02:59:49','2025-10-04 02:59:49',NULL),
(61,150,1,'reclamos','public/documentos/f_68e08db445f023.41097270.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e08db445f023.41097270.docx','supabase','CALIDAD.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',22108,NULL,'2025-10-04 03:00:04','2025-10-04 03:00:04',NULL),
(62,150,1,'reclamos','public/documentos/f_68e08df1de4a89.91799033.pdf','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e08df1de4a89.91799033.pdf','supabase','Protocolo de Atención a Usuarios Digital Services.pdf','application/pdf',126557,NULL,'2025-10-04 03:01:06','2025-10-04 03:01:06',NULL),
(63,149,1,'reclamos','public/documentos/f_68e08e380cd191.49529675.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e08e380cd191.49529675.docx','supabase','AMD CON SPRINT.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',16194,NULL,'2025-10-04 03:02:16','2025-10-04 03:02:16',NULL),
(64,50,1,'reclamos','public/documentos/f_68e08e91229791.47587044.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e08e91229791.47587044.docx','supabase','LIDER OPERATIVO.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',22978,NULL,'2025-10-04 03:03:45','2025-10-04 03:03:45',NULL),
(65,150,1,'reclamos','public/documentos/f_68e096c511d2e6.08648686.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e096c511d2e6.08648686.jpg','supabase','almendras.jpg','image/jpeg',109210,NULL,'2025-10-04 03:38:45','2025-10-04 03:38:45',NULL),
(66,150,1,'reclamos','public/documentos/f_68e09749b903f2.47708818.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e09749b903f2.47708818.png','supabase','images.png','image/png',977131,NULL,'2025-10-04 03:40:58','2025-10-04 03:40:58',NULL),
(67,150,1,'reclamos','public/documentos/f_68e0fd1f6ea3c6.79996569.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e0fd1f6ea3c6.79996569.docx','supabase','AMD CON SPRINT.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',16194,NULL,'2025-10-04 10:55:28','2025-10-04 10:55:28',NULL),
(68,150,1,'reclamos','public/documentos/f_68e100e48c2fb1.36005493.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e100e48c2fb1.36005493.docx','supabase','LIDER OPERATIVO.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',22978,NULL,'2025-10-04 11:11:33','2025-10-04 11:11:33',NULL),
(69,150,1,'reclamos','public/documentos/f_68e1010b3b0398.06143106.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e1010b3b0398.06143106.docx','supabase','CALIDAD.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',22108,NULL,'2025-10-04 11:12:11','2025-10-04 11:12:11',NULL),
(70,150,1,'reclamos','public/documentos/f_68e10135374d52.48489781.pdf','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e10135374d52.48489781.pdf','supabase','Cronograma Proyecto Bauerberg-Klein[1].pdf','application/pdf',224094,NULL,'2025-10-04 11:12:53','2025-10-04 11:12:53',NULL),
(71,150,1,'reclamos','public/documentos/f_68e1019f890bd1.82020100.docx','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68e1019f890bd1.82020100.docx','supabase','CALIDAD.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',22108,NULL,'2025-10-04 11:14:39','2025-10-04 11:14:39',NULL),
(72,156,1,'reclamos','public/documentos/f_68ed3b7565b229.45252102.png','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ed3b7565b229.45252102.png','supabase','Tarifa URBANO AMBA PCh (2).png','image/png',546816,NULL,'2025-10-13 17:48:38','2025-10-13 17:48:38',NULL),
(73,153,1,'reclamos','public/documentos/f_68ed3e28382ab9.22896936.pdf','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ed3e28382ab9.22896936.pdf','supabase','seguro_automotor_AF740IW.pdf','application/pdf',138666,NULL,'2025-10-13 18:00:09','2025-10-13 18:00:09',NULL),
(74,50,1,'reclamos','public/documentos/f_68ed4d77bd4ef8.91710755.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ed4d77bd4ef8.91710755.jpg','supabase','CaceresAriel27Agosto.jpg','image/jpeg',182144,NULL,'2025-10-13 19:05:28','2025-10-13 19:05:28',NULL),
(75,61,1,'reclamos','public/documentos/f_68ee4dc53f9536.84357398.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ee4dc53f9536.84357398.jpg','supabase','1669d086-0edd-4700-9b8c-ea070b959b4e.jpg','image/jpeg',130939,NULL,'2025-10-14 13:19:02','2025-10-14 13:19:02',NULL),
(76,61,1,'reclamos','public/documentos/f_68ee4dc75a2231.46425242.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ee4dc75a2231.46425242.jpg','supabase','af1a47b3-f733-4288-9f7a-b2ffc3259258.jpg','image/jpeg',96333,NULL,'2025-10-14 13:19:03','2025-10-14 13:19:03',NULL),
(77,187,1,'reclamos','public/documentos/f_68ef8dd96b6f49.95971139.jpg','https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ef8dd96b6f49.95971139.jpg','supabase','logistica.jpg','image/jpeg',7251,NULL,'2025-10-15 12:04:42','2025-10-15 12:04:42',NULL);
/*!40000 ALTER TABLE `archivos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `auditable_type` varchar(255) NOT NULL,
  `auditable_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `changes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`changes`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_auditable_type_auditable_id_index` (`auditable_type`,`auditable_id`),
  KEY `audit_logs_user_id_index` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=205 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES
(1,NULL,'App\\Models\\User',6,'updated','{\"new\": {\"password\": \"$2y$12$f1IPfqrsb9hi4YtzwT/8w.pDKW/YPRRDQ.4WeKGci6TXAl.PA91a.\"}, \"old\": {\"password\": \"$2y$12$fll0NX6auT0RKaI2OuFAw.4PWW4JFKpmp6KsE7sadYWcgDT/IXU5i\"}}','127.0.0.1','Symfony','2025-10-09 14:41:50','2025-10-09 14:41:50'),
(2,6,'App\\Models\\Sucursal',293,'created','{\"attributes\": {\"id\": 293, \"nombre\": \"yacare\", \"direccion\": \"1234\", \"cliente_id\": 14}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:02:24','2025-10-13 12:02:24'),
(3,6,'App\\Models\\Sucursal',294,'created','{\"attributes\": {\"id\": 294, \"nombre\": \"Chaco\", \"direccion\": \"\\\"Avenida Republica del Israel 2502. recibe gente Paso de la Patria 2551, H3506 Resistencia, Chaco salen las camionetas  https://maps.app.goo.gl/Gts8AJDxuNSLa5yZ9\\\"\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:36:28','2025-10-13 12:36:28'),
(4,6,'App\\Models\\Sucursal',295,'created','{\"attributes\": {\"id\": 295, \"nombre\": \"Catamarca\", \"direccion\": \"\\\"calle av. Nestor Kichner. ruta 38.  https://www.google.com/maps?q=-28.482011,-65.7407841\\\"\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:36:28','2025-10-13 12:36:28'),
(5,6,'App\\Models\\Sucursal',296,'created','{\"attributes\": {\"id\": 296, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:36:28','2025-10-13 12:36:28'),
(6,6,'App\\Models\\Sucursal',297,'created','{\"attributes\": {\"id\": 297, \"nombre\": \"jhghjg\", \"direccion\": \"jkhkjn\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:36:28','2025-10-13 12:36:28'),
(7,6,'App\\Models\\Sucursal',298,'created','{\"attributes\": {\"id\": 298, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:37:55','2025-10-13 12:37:55'),
(8,6,'App\\Models\\Sucursal',299,'created','{\"attributes\": {\"id\": 299, \"nombre\": \"Chaco\", \"direccion\": \"\\\"Avenida Republica del Israel 2502. recibe gente Paso de la Patria 2551, H3506 Resistencia, Chaco salen las camionetas  https://maps.app.goo.gl/Gts8AJDxuNSLa5yZ9\\\"\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:37:55','2025-10-13 12:37:55'),
(9,6,'App\\Models\\Sucursal',300,'created','{\"attributes\": {\"id\": 300, \"nombre\": \"Catamarca\", \"direccion\": \"\\\"calle av. Nestor Kichner. ruta 38.  https://www.google.com/maps?q=-28.482011,-65.7407841\\\"\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:37:55','2025-10-13 12:37:55'),
(10,18,'App\\Models\\Reclamo',53,'created','{\"attributes\": {\"id\": 53, \"pagado\": false, \"status\": \"creado\", \"agente_id\": \"2\", \"persona_id\": 149, \"reclamo_type_id\": \"4\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:42:37','2025-10-13 12:42:37'),
(11,18,'App\\Models\\ReclamoComment',159,'created','{\"attributes\": {\"id\": 159, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 53, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:42:38','2025-10-13 12:42:38'),
(12,2,'App\\Models\\ReclamoComment',160,'created','{\"attributes\": {\"id\": 160, \"message\": \"hola no funciona\", \"creator_id\": 2, \"reclamo_id\": 53, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:43:00','2025-10-13 12:43:00'),
(13,18,'App\\Models\\ReclamoComment',161,'created','{\"attributes\": {\"id\": 161, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 53, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:44:16','2025-10-13 12:44:16'),
(14,18,'App\\Models\\Reclamo',53,'updated','{\"new\": {\"status\": \"en_proceso\", \"agente_id\": 18}, \"old\": {\"status\": \"creado\", \"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:44:16','2025-10-13 12:44:16'),
(15,18,'App\\Models\\Reclamo',53,'updated','{\"new\": {\"agente_id\": 2}, \"old\": {\"agente_id\": 18}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:44:26','2025-10-13 12:44:26'),
(16,2,'App\\Models\\Reclamo',53,'updated','{\"new\": {\"agente_id\": 18}, \"old\": {\"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:44:53','2025-10-13 12:44:53'),
(17,2,'App\\Models\\ReclamoComment',162,'created','{\"attributes\": {\"id\": 162, \"message\": \"probando\", \"creator_id\": 2, \"reclamo_id\": 53, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:45:27','2025-10-13 12:45:27'),
(18,18,'App\\Models\\ReclamoComment',163,'created','{\"attributes\": {\"id\": 163, \"message\": \"probando\", \"creator_id\": 18, \"reclamo_id\": 53, \"sender_type\": \"agente\", \"sender_user_id\": 18}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:45:50','2025-10-13 12:45:50'),
(19,18,'App\\Models\\Reclamo',53,'updated','{\"new\": {\"agente_id\": 2}, \"old\": {\"agente_id\": 18}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:46:07','2025-10-13 12:46:07'),
(20,2,'App\\Models\\ReclamoComment',164,'created','{\"attributes\": {\"id\": 164, \"message\": \"probando 2.0\", \"creator_id\": 2, \"reclamo_id\": 53, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:46:22','2025-10-13 12:46:22'),
(21,2,'App\\Models\\ReclamoComment',165,'created','{\"attributes\": {\"id\": 165, \"message\": \"probando 3.0\", \"creator_id\": 2, \"reclamo_id\": 53, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:46:44','2025-10-13 12:46:44'),
(22,2,'App\\Models\\ReclamoComment',166,'created','{\"attributes\": {\"id\": 166, \"message\": \"la cajeta de mudra\", \"creator_id\": 2, \"reclamo_id\": 53, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:47:03','2025-10-13 12:47:03'),
(23,18,'App\\Models\\Reclamo',53,'deleted','{\"attributes\": {\"id\": 53, \"pagado\": false, \"status\": \"en_proceso\", \"detalle\": null, \"agente_id\": 2, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 149, \"reclamo_type_id\": 4}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:47:29','2025-10-13 12:47:29'),
(24,18,'App\\Models\\Reclamo',54,'created','{\"attributes\": {\"id\": 54, \"pagado\": false, \"status\": \"creado\", \"agente_id\": \"2\", \"persona_id\": 147, \"reclamo_type_id\": \"4\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:47:45','2025-10-13 12:47:45'),
(25,18,'App\\Models\\ReclamoComment',167,'created','{\"attributes\": {\"id\": 167, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 54, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:47:46','2025-10-13 12:47:46'),
(26,2,'App\\Models\\ReclamoComment',168,'created','{\"attributes\": {\"id\": 168, \"message\": \"probando\", \"creator_id\": 2, \"reclamo_id\": 54, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:47:59','2025-10-13 12:47:59'),
(27,2,'App\\Models\\ReclamoComment',169,'created','{\"attributes\": {\"id\": 169, \"message\": \"ok dale porbando\", \"creator_id\": 2, \"reclamo_id\": 54, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 12:48:21','2025-10-13 12:48:21'),
(28,18,'App\\Models\\Reclamo',54,'deleted','{\"attributes\": {\"id\": 54, \"pagado\": false, \"status\": \"creado\", \"detalle\": null, \"agente_id\": 2, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 147, \"reclamo_type_id\": 4}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:53:34','2025-10-13 12:53:34'),
(29,6,'App\\Models\\Sucursal',301,'created','{\"attributes\": {\"id\": 301, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:54:43','2025-10-13 12:54:43'),
(30,6,'App\\Models\\Sucursal',302,'created','{\"attributes\": {\"id\": 302, \"nombre\": \"gghfgh\", \"direccion\": \"fghfgh\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:54:43','2025-10-13 12:54:43'),
(31,6,'App\\Models\\Sucursal',303,'created','{\"attributes\": {\"id\": 303, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:55:34','2025-10-13 12:55:34'),
(32,6,'App\\Models\\Sucursal',304,'created','{\"attributes\": {\"id\": 304, \"nombre\": \"fghfghg\", \"direccion\": \"fghfgh\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:55:34','2025-10-13 12:55:34'),
(33,6,'App\\Models\\Sucursal',305,'created','{\"attributes\": {\"id\": 305, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:58:12','2025-10-13 12:58:12'),
(34,6,'App\\Models\\Sucursal',306,'created','{\"attributes\": {\"id\": 306, \"nombre\": \"Rosario\", \"direccion\": \"1234\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:58:12','2025-10-13 12:58:12'),
(35,6,'App\\Models\\Sucursal',307,'created','{\"attributes\": {\"id\": 307, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:58:51','2025-10-13 12:58:51'),
(36,6,'App\\Models\\Sucursal',308,'created','{\"attributes\": {\"id\": 308, \"nombre\": \"Corboba\", \"direccion\": \"1324\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:58:51','2025-10-13 12:58:51'),
(37,6,'App\\Models\\Sucursal',309,'created','{\"attributes\": {\"id\": 309, \"nombre\": \"Corrientes\", \"direccion\": \"1324\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:58:51','2025-10-13 12:58:51'),
(38,6,'App\\Models\\Sucursal',310,'created','{\"attributes\": {\"id\": 310, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 12:59:27','2025-10-13 12:59:27'),
(39,6,'App\\Models\\Sucursal',311,'created','{\"attributes\": {\"id\": 311, \"nombre\": \"Formosa\", \"direccion\": \"ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 13:09:26','2025-10-13 13:09:26'),
(40,6,'App\\Models\\Sucursal',312,'created','{\"attributes\": {\"id\": 312, \"nombre\": \"Avellaneda\", \"direccion\": \"1234\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 13:09:26','2025-10-13 13:09:26'),
(41,6,'App\\Models\\Sucursal',313,'created','{\"attributes\": {\"id\": 313, \"nombre\": \"Sarandi\", \"direccion\": \"145\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 13:09:26','2025-10-13 13:09:26'),
(42,6,'App\\Models\\Sucursal',314,'created','{\"attributes\": {\"id\": 314, \"nombre\": \"Bahia Blanca\", \"direccion\": \"1456\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 13:09:26','2025-10-13 13:09:26'),
(43,6,'App\\Models\\Sucursal',315,'created','{\"attributes\": {\"id\": 315, \"nombre\": \"Neuquen\", \"direccion\": \"1545\", \"cliente_id\": 13}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 13:09:26','2025-10-13 13:09:26'),
(44,4,'App\\Models\\Persona',152,'created','{\"attributes\": {\"id\": 152, \"cuil\": \"20321288813\", \"pago\": 0, \"tipo\": 1, \"email\": \"leonel.g.arce@gmail.com\", \"nombres\": \"Leonel Gaston\", \"patente\": \"AF527VH\", \"telefono\": \"3413067326\", \"agente_id\": 9, \"apellidos\": \"Arce\", \"cbu_alias\": \"0650080102000054813917\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-03 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:11:40','2025-10-13 13:11:40'),
(45,4,'App\\Models\\Persona',153,'created','{\"attributes\": {\"id\": 153, \"cuil\": \"20283353444\", \"pago\": 0, \"tipo\": 1, \"email\": \"gusdrummer80@gmail.com\", \"nombres\": \"Gustavo Raul\", \"patente\": \"LUN807\", \"telefono\": \"3413723564\", \"agente_id\": 7, \"apellidos\": \"Bordon\", \"cbu_alias\": \"0000003100002398713449\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2024-03-18 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:14:48','2025-10-13 13:14:48'),
(46,4,'App\\Models\\Persona',154,'created','{\"attributes\": {\"id\": 154, \"cuil\": \"20287622237\", \"pago\": 0, \"tipo\": 1, \"email\": \"ramonesblotta@gmail.com\", \"nombres\": \"Ramon Ernesto\", \"patente\": \"AH240WH\", \"telefono\": \"03416639264\", \"agente_id\": 3, \"apellidos\": \"Blotta\", \"cbu_alias\": \"0000003100026498549801\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-04-23 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:18:54','2025-10-13 13:18:54'),
(47,4,'App\\Models\\Persona',155,'created','{\"attributes\": {\"id\": 155, \"cuil\": \"20431272297\", \"pago\": 0, \"tipo\": 1, \"email\": \"lautarob23@hotmail.com\", \"nombres\": \"Ruben Marcelo\", \"patente\": \"AC614XQ\", \"telefono\": \"03415904792\", \"agente_id\": 2, \"apellidos\": \"Bolognese\", \"cbu_alias\": \"0000003100036347481518\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-05 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:26:14','2025-10-13 13:26:14'),
(48,4,'App\\Models\\Persona',156,'created','{\"attributes\": {\"id\": 156, \"cuil\": \"23220917649\", \"pago\": 0, \"tipo\": 1, \"email\": \"arielbruni@hotmail.com\", \"nombres\": \"Ariel Jose\", \"patente\": \"AF589FL\", \"telefono\": \"3413244050\", \"agente_id\": 2, \"apellidos\": \"Bruni\", \"cbu_alias\": \"0110444230044440667451\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-12 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:30:07','2025-10-13 13:30:07'),
(49,4,'App\\Models\\Persona',157,'created','{\"attributes\": {\"id\": 157, \"cuil\": \"27469706023\", \"pago\": 0, \"tipo\": 1, \"email\": \"colacraigustavo@gmail.com\", \"nombres\": \"Gustavo German\", \"patente\": \"AA890GX\", \"telefono\": \"3416591737\", \"agente_id\": 11, \"apellidos\": \"Colacrai\", \"cbu_alias\": \"0000003100085551758516\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2023-11-10 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:34:27','2025-10-13 13:34:27'),
(50,4,'App\\Models\\Persona',158,'created','{\"attributes\": {\"id\": 158, \"cuil\": \"20250024674\", \"pago\": 0, \"tipo\": 1, \"email\": \"arieldario83@gmail.com\", \"nombres\": \"Ariel Dario\", \"patente\": \"DWF207\", \"telefono\": \"3413787406\", \"agente_id\": 3, \"apellidos\": \"Ciz\", \"cbu_alias\": \"0270043420057404700038\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-07 00:00:00\", \"combustible\": true, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:36:54','2025-10-13 13:36:54'),
(51,4,'App\\Models\\Persona',159,'created','{\"attributes\": {\"id\": 159, \"cuil\": \"20171524238\", \"pago\": 0, \"tipo\": 1, \"email\": \"nes69-@hotmail.com\", \"nombres\": \"Nestor Ruben\", \"patente\": \"HDD583\", \"telefono\": \"3416579826\", \"agente_id\": 3, \"apellidos\": \"Cuello\", \"cbu_alias\": \"0720371688000001714586\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-19 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:43:35','2025-10-13 13:43:35'),
(52,4,'App\\Models\\Persona',160,'created','{\"attributes\": {\"id\": 160, \"cuil\": \"1\", \"pago\": 0, \"tipo\": 2, \"email\": \"hernanjaimes85@gmail.com\", \"nombres\": \"Leonardo Andres D\'Accorso\", \"patente\": \"JJR686\", \"telefono\": \"3415931575\", \"agente_id\": 3, \"apellidos\": null, \"cbu_alias\": \"1\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-03-13 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:48:40','2025-10-13 13:48:40'),
(53,4,'App\\Models\\Dueno',18,'created','{\"attributes\": {\"id\": 18, \"cuil\": \"20315711208\", \"email\": \"hernanjaimes85@gmail.com\", \"telefono\": \"3416436529\", \"cbu_alias\": \"0720371688000036154872\", \"persona_id\": 160, \"cuil_cobrador\": \"20315711208\", \"observaciones\": null, \"nombreapellido\": \"Hernan Rene Jaimes\", \"fecha_nacimiento\": \"1978-12-20 00:00:00\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:48:40','2025-10-13 13:48:40'),
(54,4,'App\\Models\\Persona',161,'created','{\"attributes\": {\"id\": 161, \"cuil\": \"23350222529\", \"pago\": 0, \"tipo\": 1, \"email\": \"seb.dl@hotmail.com\", \"nombres\": \"Sebastian\", \"patente\": \"AC302FC\", \"telefono\": \"3416248889\", \"agente_id\": 3, \"apellidos\": \"Di Lorenzo\", \"cbu_alias\": \"0070233330004031451102\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-19 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:52:27','2025-10-13 13:52:27'),
(55,4,'App\\Models\\Persona',162,'created','{\"attributes\": {\"id\": 162, \"cuil\": \"20468371597\", \"pago\": 0, \"tipo\": 1, \"email\": \"melettamatias05@gmail.com\", \"nombres\": \"Kevin Jeremias\", \"patente\": \"FQD232\", \"telefono\": \"3412610968\", \"agente_id\": 9, \"apellidos\": \"Jaeggi\", \"cbu_alias\": \"0070134730004005071721\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-11 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:55:12','2025-10-13 13:55:12'),
(56,4,'App\\Models\\Persona',163,'created','{\"attributes\": {\"id\": 163, \"cuil\": \"20296864499\", \"pago\": 0, \"tipo\": 1, \"email\": \"nicolasestrada1@hotmail.com\", \"nombres\": \"Nicolas Edgardo\", \"patente\": \"KVR843\", \"telefono\": \"3413737353\", \"agente_id\": 3, \"apellidos\": \"Estrada\", \"cbu_alias\": \"0000076500000008501789\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2024-11-28 00:00:00\", \"combustible\": true, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 13:58:26','2025-10-13 13:58:26'),
(57,4,'App\\Models\\Persona',164,'created','{\"attributes\": {\"id\": 164, \"cuil\": \"1\", \"pago\": 0, \"tipo\": 2, \"email\": \"Tomasajgonzalez@gmail.com\", \"nombres\": \"Diego Hernan Garcia\", \"patente\": \"AA056GL\", \"telefono\": \"3412555321\", \"agente_id\": 2, \"apellidos\": null, \"cbu_alias\": \"1\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-27 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:10:24','2025-10-13 14:10:24'),
(58,4,'App\\Models\\Dueno',19,'created','{\"attributes\": {\"id\": 19, \"cuil\": \"20416559350\", \"email\": \"tomasajgonzalez@gmail.com\", \"telefono\": \"3413626585\", \"cbu_alias\": \"0720371688000002236168\", \"persona_id\": 164, \"cuil_cobrador\": \"20416559350\", \"observaciones\": null, \"nombreapellido\": \"Tomas Alejandro Gonzalez\", \"fecha_nacimiento\": \"1999-04-16 00:00:00\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:10:24','2025-10-13 14:10:24'),
(59,4,'App\\Models\\Persona',165,'created','{\"attributes\": {\"id\": 165, \"cuil\": \"20416559350\", \"pago\": 0, \"tipo\": 1, \"email\": \"Tomasajgonzalez@gmail.com\", \"nombres\": \"Tomas Alejandro\", \"patente\": \"JLE386\", \"telefono\": \"03413626585\", \"agente_id\": 2, \"apellidos\": \"Gonzalez\", \"cbu_alias\": \"0720371688000002236168\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-08-06 00:00:00\", \"combustible\": true, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:12:32','2025-10-13 14:12:32'),
(60,4,'App\\Models\\Persona',166,'created','{\"attributes\": {\"id\": 166, \"cuil\": \"20242400489\", \"pago\": 0, \"tipo\": 1, \"email\": \"gabriel6970@hotmail.com\", \"nombres\": \"Gabriel Eduardo\", \"patente\": \"AB419EW\", \"telefono\": \"3415996230\", \"agente_id\": 3, \"apellidos\": \"Glardon\", \"cbu_alias\": \"2850369940094652078878\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-28 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:17:00','2025-10-13 14:17:00'),
(61,4,'App\\Models\\Persona',167,'created','{\"attributes\": {\"id\": 167, \"cuil\": \"20452648947\", \"pago\": 0, \"tipo\": 1, \"email\": \"thiagoomg21@gmail.com\", \"nombres\": \"Thiago  Nahuel\", \"patente\": \"VPM076\", \"telefono\": \"03415104124\", \"agente_id\": 3, \"apellidos\": \"Gomez\", \"cbu_alias\": \"2850672840095659080608\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-24 00:00:00\", \"combustible\": true, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:20:56','2025-10-13 14:20:56'),
(62,4,'App\\Models\\Persona',168,'created','{\"attributes\": {\"id\": 168, \"cuil\": \"20391225975\", \"pago\": 0, \"tipo\": 1, \"email\": \"Hernanimperatrice@hotmail.com\", \"nombres\": \"Hernan\", \"patente\": \"AH461GK\", \"telefono\": \"03415321790\", \"agente_id\": 2, \"apellidos\": \"Imperatrice\", \"cbu_alias\": \"0000003100031002841920\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-17 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:23:55','2025-10-13 14:23:55'),
(63,4,'App\\Models\\Persona',169,'created','{\"attributes\": {\"id\": 169, \"cuil\": \"20321256466\", \"pago\": 0, \"tipo\": 1, \"email\": \"lacorteadrian@hotmail.com\", \"nombres\": \"Adrian Roberto\", \"patente\": \"AB559TO\", \"telefono\": \"03413113314\", \"agente_id\": 9, \"apellidos\": \"Lacorte\", \"cbu_alias\": \"0170081740000047459225\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-25 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:25:55','2025-10-13 14:25:55'),
(64,4,'App\\Models\\Persona',170,'created','{\"attributes\": {\"id\": 170, \"cuil\": \"20391225444\", \"pago\": 0, \"tipo\": 1, \"email\": \"Hectorleguiza16@gmail.com\", \"nombres\": \"Hector\", \"patente\": \"AA338VB\", \"telefono\": \"03413797781\", \"agente_id\": 2, \"apellidos\": \"Leguiza\", \"cbu_alias\": \"2850672840095068801348\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-07-28 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:27:54','2025-10-13 14:27:54'),
(65,4,'App\\Models\\Persona',171,'created','{\"attributes\": {\"id\": 171, \"cuil\": \"20325135590\", \"pago\": 0, \"tipo\": 1, \"email\": \"jesusperfietto@hotmail.com\", \"nombres\": \"Ricardo Jesus\", \"patente\": \"AE458ZV\", \"telefono\": \"3416670191\", \"agente_id\": 9, \"apellidos\": \"Perfietto\", \"cbu_alias\": \"19102748-55127402360467\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-08-04 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 14:44:24','2025-10-13 14:44:24'),
(66,4,'App\\Models\\Persona',172,'created','{\"attributes\": {\"id\": 172, \"cuil\": \"20263562195\", \"pago\": 0, \"tipo\": 1, \"email\": \"Horacioricci614@gmail.com\", \"nombres\": \"Horacio Gabriel\", \"patente\": \"AH226NT\", \"telefono\": \"03416055761\", \"agente_id\": 3, \"apellidos\": \"Ricci\", \"cbu_alias\": \"0000003100098020322491\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-22 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 15:13:28','2025-10-13 15:13:28'),
(67,4,'App\\Models\\Persona',173,'created','{\"attributes\": {\"id\": 173, \"cuil\": \"20335254504\", \"pago\": 0, \"tipo\": 1, \"email\": \"hernanstrambi19@gmail.com\", \"nombres\": \"Hernan Dario\", \"patente\": \"MGI401\", \"telefono\": \"3412261654\", \"agente_id\": 3, \"apellidos\": \"Strambi\", \"cbu_alias\": \"2850791240095870359228\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-05 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 15:18:26','2025-10-13 15:18:26'),
(68,4,'App\\Models\\Persona',174,'created','{\"attributes\": {\"id\": 174, \"cuil\": \"27435765918\", \"pago\": 0, \"tipo\": 1, \"email\": \"Robertooscar778@gmail.com\", \"nombres\": \"Roberto Oscar\", \"patente\": \"AH473UP\", \"telefono\": \"3415055105\", \"agente_id\": 3, \"apellidos\": \"Velozo\", \"cbu_alias\": \"0000003100031468789477\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-25 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 15:21:05','2025-10-13 15:21:05'),
(69,4,'App\\Models\\Persona',175,'created','{\"attributes\": {\"id\": 175, \"cuil\": \"20238891532\", \"pago\": 0, \"tipo\": 1, \"email\": \"mojicasergio74@gmail.com\", \"nombres\": \"Sergio Daniel\", \"patente\": \"GSW442\", \"telefono\": \"3413807019\", \"agente_id\": 2, \"apellidos\": \"Mojica\", \"cbu_alias\": \"Sergio.153.dorado.mp\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2024-02-02 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 15:24:11','2025-10-13 15:24:11'),
(70,4,'App\\Models\\Persona',176,'created','{\"attributes\": {\"id\": 176, \"cuil\": \"27261353194\", \"pago\": 0, \"tipo\": 1, \"email\": \"veroines777@yahoo.com.ar\", \"nombres\": \"Veronica Ines\", \"patente\": \"FXQ481\", \"telefono\": \"3412786530\", \"agente_id\": 9, \"apellidos\": \"Oviedo Rivero\", \"cbu_alias\": \"0110140530014034118951\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-20 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 15:28:05','2025-10-13 15:28:05'),
(71,2,'App\\Models\\Reclamo',55,'created','{\"attributes\": {\"id\": 55, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"falta dia 15 de septiembre\", \"agente_id\": \"2\", \"fecha_alta\": \"2025-10-10 00:00:00\", \"persona_id\": 156, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:47:13','2025-10-13 17:47:13'),
(72,2,'App\\Models\\ReclamoComment',170,'created','{\"attributes\": {\"id\": 170, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 55, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:47:14','2025-10-13 17:47:14'),
(73,2,'App\\Models\\ReclamoComment',171,'created','{\"attributes\": {\"id\": 171, \"message\": \"ariel te falto lahoja de ruta\", \"creator_id\": 2, \"reclamo_id\": 55, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:47:57','2025-10-13 17:47:57'),
(74,2,'App\\Models\\ReclamoComment',172,'created','{\"attributes\": {\"id\": 172, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 55, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:48:07','2025-10-13 17:48:07'),
(75,2,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"status\": \"en_proceso\", \"agente_id\": 18}, \"old\": {\"status\": \"creado\", \"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:48:07','2025-10-13 17:48:07'),
(76,2,'App\\Models\\Archivo',72,'created','{\"attributes\": {\"id\": 72, \"disk\": \"supabase\", \"mime\": \"image/png\", \"ruta\": \"public/documentos/f_68ed3b7565b229.45252102.png\", \"size\": 546816, \"carpeta\": \"reclamos\", \"persona_id\": 156, \"download_url\": \"https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ed3b7565b229.45252102.png\", \"nombre_original\": \"Tarifa URBANO AMBA PCh (2).png\", \"tipo_archivo_id\": 1}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:48:38','2025-10-13 17:48:38'),
(77,2,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"agente_id\": 2}, \"old\": {\"agente_id\": 18}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:48:53','2025-10-13 17:48:53'),
(78,2,'App\\Models\\ReclamoComment',173,'created','{\"attributes\": {\"id\": 173, \"message\": \"liisto ya lo subo moni\", \"creator_id\": 2, \"reclamo_id\": 55, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:48:55','2025-10-13 17:48:55'),
(79,2,'App\\Models\\ReclamoComment',174,'created','{\"attributes\": {\"id\": 174, \"message\": \"Estado cambiado de en proceso a rechazado\", \"creator_id\": null, \"reclamo_id\": 55, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:16','2025-10-13 17:50:16'),
(80,2,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"status\": \"rechazado\"}, \"old\": {\"status\": \"en_proceso\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:16','2025-10-13 17:50:16'),
(81,2,'App\\Models\\ReclamoComment',175,'created','{\"attributes\": {\"id\": 175, \"message\": \"Estado cambiado de rechazado a aceptado\", \"creator_id\": null, \"reclamo_id\": 55, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:20','2025-10-13 17:50:20'),
(82,2,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"status\": \"aceptado\"}, \"old\": {\"status\": \"rechazado\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:20','2025-10-13 17:50:20'),
(83,2,'App\\Models\\ReclamoComment',176,'created','{\"attributes\": {\"id\": 176, \"message\": \"Estado cambiado de aceptado a en proceso\", \"creator_id\": null, \"reclamo_id\": 55, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:38','2025-10-13 17:50:38'),
(84,2,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"status\": \"en_proceso\"}, \"old\": {\"status\": \"aceptado\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:38','2025-10-13 17:50:38'),
(85,2,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"pagado\": true}, \"old\": {\"pagado\": false}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:50:46','2025-10-13 17:50:46'),
(86,12,'App\\Models\\Reclamo',55,'updated','{\"new\": {\"agente_id\": 12}, \"old\": {\"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:56:22','2025-10-13 17:56:22'),
(87,12,'App\\Models\\ReclamoComment',177,'created','{\"attributes\": {\"id\": 177, \"message\": \"perfedctplslahdkashd\", \"creator_id\": 12, \"reclamo_id\": 55, \"sender_type\": \"agente\", \"sender_user_id\": 12}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:56:24','2025-10-13 17:56:24'),
(88,12,'App\\Models\\Reclamo',55,'deleted','{\"attributes\": {\"id\": 55, \"pagado\": true, \"status\": \"en_proceso\", \"detalle\": \"falta dia 15 de septiembre\", \"agente_id\": 12, \"creator_id\": null, \"fecha_alta\": \"2025-10-10T00:00:00.000000Z\", \"persona_id\": 156, \"reclamo_type_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:57:03','2025-10-13 17:57:03'),
(89,12,'App\\Models\\Reclamo',56,'created','{\"attributes\": {\"id\": 56, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"xzczxvv\", \"agente_id\": \"2\", \"fecha_alta\": \"2025-10-05 00:00:00\", \"persona_id\": 153, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 17:58:37','2025-10-13 17:58:37'),
(90,12,'App\\Models\\ReclamoComment',178,'created','{\"attributes\": {\"id\": 178, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 56, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 17:58:38','2025-10-13 17:58:38'),
(91,2,'App\\Models\\ReclamoComment',179,'created','{\"attributes\": {\"id\": 179, \"message\": \"hoaquin te olvidaste de mandar la hija de ruta\", \"creator_id\": 2, \"reclamo_id\": 56, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:59:32','2025-10-13 17:59:32'),
(92,2,'App\\Models\\ReclamoComment',180,'created','{\"attributes\": {\"id\": 180, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 56, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:59:39','2025-10-13 17:59:39'),
(93,2,'App\\Models\\Reclamo',56,'updated','{\"new\": {\"status\": \"en_proceso\", \"agente_id\": 12}, \"old\": {\"status\": \"creado\", \"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 17:59:39','2025-10-13 17:59:39'),
(94,12,'App\\Models\\Archivo',73,'created','{\"attributes\": {\"id\": 73, \"disk\": \"supabase\", \"mime\": \"application/pdf\", \"ruta\": \"public/documentos/f_68ed3e28382ab9.22896936.pdf\", \"size\": 138666, \"carpeta\": \"reclamos\", \"persona_id\": 153, \"download_url\": \"https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ed3e28382ab9.22896936.pdf\", \"nombre_original\": \"seguro_automotor_AF740IW.pdf\", \"tipo_archivo_id\": 1}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 18:00:09','2025-10-13 18:00:09'),
(95,12,'App\\Models\\ReclamoComment',181,'created','{\"attributes\": {\"id\": 181, \"message\": \"monica ya te adjunte\", \"creator_id\": 12, \"reclamo_id\": 56, \"sender_type\": \"agente\", \"sender_user_id\": 12}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 18:00:25','2025-10-13 18:00:25'),
(96,12,'App\\Models\\Reclamo',56,'updated','{\"new\": {\"agente_id\": 2}, \"old\": {\"agente_id\": 12}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 18:00:28','2025-10-13 18:00:28'),
(97,6,'App\\Models\\Persona',177,'created','{\"attributes\": {\"id\": 177, \"cuil\": \"1\", \"pago\": 0, \"tipo\": 1, \"email\": \"maurithonewells10@gmail.com\", \"nombres\": \"MAURO HECTOR\", \"patente\": \"AF238IU\", \"telefono\": \"3415667720\", \"agente_id\": 7, \"apellidos\": \"SAGLIMBENI\", \"cbu_alias\": \"1\", \"estado_id\": 2, \"unidad_id\": 2, \"cliente_id\": 4, \"fecha_alta\": \"2025-05-27 00:00:00\", \"combustible\": false, \"sucursal_id\": 8, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-13 18:17:07','2025-10-13 18:17:07'),
(98,4,'App\\Models\\Persona',178,'created','{\"attributes\": {\"id\": 178, \"cuil\": \"20317924926\", \"pago\": 0, \"tipo\": 1, \"email\": \"emmasantarcangelo74@gmail.com\", \"nombres\": \"Luis\", \"patente\": \"AG158CS\", \"telefono\": \"3413689555\", \"agente_id\": 11, \"apellidos\": \"Santarcangelo\", \"cbu_alias\": \"0070704830004001928328\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2022-09-05 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 18:33:16','2025-10-13 18:33:16'),
(99,4,'App\\Models\\Persona',179,'created','{\"attributes\": {\"id\": 179, \"cuil\": \"27250797074\", \"pago\": 0, \"tipo\": 1, \"email\": \"flaco.leproso@hotmail.com\", \"nombres\": \"Daniel Alejandro\", \"patente\": \"AF330VO\", \"telefono\": \"3416413419\", \"agente_id\": 2, \"apellidos\": \"Redigonda\", \"cbu_alias\": \"0000076500000040710569\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-04-04 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 18:45:46','2025-10-13 18:45:46'),
(100,4,'App\\Models\\Persona',180,'created','{\"attributes\": {\"id\": 180, \"cuil\": \"27260059152\", \"pago\": 0, \"tipo\": 1, \"email\": \"rinaldidamian@yahoo.com.ar\", \"nombres\": \"Damian Francisco\", \"patente\": \"AF922HQ\", \"telefono\": \"3415624036\", \"agente_id\": 9, \"apellidos\": \"Rinaldi\", \"cbu_alias\": \"0720277588000037617154\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-28 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 18:50:03','2025-10-13 18:50:03'),
(101,4,'App\\Models\\Persona',181,'created','{\"attributes\": {\"id\": 181, \"cuil\": \"27314962422\", \"pago\": 0, \"tipo\": 1, \"email\": \"duiegogustavo@gmail.com\", \"nombres\": \"Diego Gustavo\", \"patente\": \"AH173BS\", \"telefono\": \"3412020758\", \"agente_id\": 3, \"apellidos\": \"Riquelme\", \"cbu_alias\": \"0000229700000000163224\", \"estado_id\": 3, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-28 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 18:54:28','2025-10-13 18:54:28'),
(102,4,'App\\Models\\Persona',182,'created','{\"attributes\": {\"id\": 182, \"cuil\": \"20345638726\", \"pago\": 0, \"tipo\": 1, \"email\": \"es6536180@gmail.com\", \"nombres\": \"Ezequiel Maximiliano\", \"patente\": \"PNW746\", \"telefono\": \"3412148033\", \"agente_id\": 3, \"apellidos\": \"Sanchez\", \"cbu_alias\": \"esanchez25.p24\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-06-19 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 18:58:14','2025-10-13 18:58:14'),
(103,4,'App\\Models\\Persona',183,'created','{\"attributes\": {\"id\": 183, \"cuil\": \"20379010726\", \"pago\": 0, \"tipo\": 1, \"email\": \"vallejoseliaas@gmail.com\", \"nombres\": \"Ezequiel Elias\", \"patente\": \"MGD077\", \"telefono\": \"3413494218\", \"agente_id\": 9, \"apellidos\": \"Vallejos\", \"cbu_alias\": \"0720478888000001745568\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2025-05-14 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 19:02:29','2025-10-13 19:02:29'),
(104,12,'App\\Models\\Archivo',74,'created','{\"attributes\": {\"id\": 74, \"disk\": \"supabase\", \"mime\": \"image/jpeg\", \"ruta\": \"public/documentos/f_68ed4d77bd4ef8.91710755.jpg\", \"size\": 182144, \"carpeta\": \"reclamos\", \"persona_id\": 50, \"download_url\": \"https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ed4d77bd4ef8.91710755.jpg\", \"nombre_original\": \"CaceresAriel27Agosto.jpg\", \"tipo_archivo_id\": 1}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 19:05:28','2025-10-13 19:05:28'),
(105,12,'App\\Models\\Reclamo',57,'created','{\"attributes\": {\"id\": 57, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Liquidación del mes de Agosto - Falto abonar el día 27 del mes\", \"agente_id\": \"2\", \"persona_id\": 50, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 19:07:04','2025-10-13 19:07:04'),
(106,12,'App\\Models\\ReclamoComment',182,'created','{\"attributes\": {\"id\": 182, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 57, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 19:07:05','2025-10-13 19:07:05'),
(107,4,'App\\Models\\Persona',184,'created','{\"attributes\": {\"id\": 184, \"cuil\": \"24321792908\", \"pago\": 0, \"tipo\": 1, \"email\": \"maroria36@gmail.com\", \"nombres\": \"Miguel Angel\", \"patente\": \"AF822IF\", \"telefono\": \"3413887700\", \"agente_id\": 7, \"apellidos\": \"Sosa\", \"cbu_alias\": \"Maroria36\", \"estado_id\": 1, \"unidad_id\": 1, \"cliente_id\": 13, \"fecha_alta\": \"2023-07-03 00:00:00\", \"combustible\": false, \"sucursal_id\": 306, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 19:24:02','2025-10-13 19:24:02'),
(108,2,'App\\Models\\ReclamoComment',183,'created','{\"attributes\": {\"id\": 183, \"message\": \"Favor de pasar el apellido distribuidor\", \"creator_id\": 2, \"reclamo_id\": 56, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-13 19:32:20','2025-10-13 19:32:20'),
(109,6,'App\\Models\\Reclamo',58,'created','{\"attributes\": {\"id\": 58, \"pagado\": false, \"status\": \"creado\", \"agente_id\": \"18\", \"persona_id\": 50, \"reclamo_type_id\": \"5\"}}','190.229.216.51','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-10-13 21:19:50','2025-10-13 21:19:50'),
(110,6,'App\\Models\\ReclamoComment',184,'created','{\"attributes\": {\"id\": 184, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 58, \"sender_type\": \"sistema\"}}','190.229.216.51','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-10-13 21:19:51','2025-10-13 21:19:51'),
(111,6,'App\\Models\\Reclamo',58,'deleted','{\"attributes\": {\"id\": 58, \"pagado\": false, \"status\": \"creado\", \"detalle\": null, \"agente_id\": 18, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 50, \"reclamo_type_id\": 5}}','190.229.216.51','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-10-13 21:20:10','2025-10-13 21:20:10'),
(112,6,'App\\Models\\Persona',185,'created','{\"attributes\": {\"id\": 185, \"cuil\": \"20311174178\", \"pago\": 0, \"tipo\": 1, \"email\": \"morellfrancisco@gmail.com\", \"nombres\": \"Francisco\", \"patente\": \"ab019gu\", \"telefono\": \"03794012093\", \"agente_id\": 22, \"apellidos\": \"Morell\", \"cbu_alias\": \"1\", \"estado_id\": 1, \"unidad_id\": 6, \"cliente_id\": 4, \"fecha_alta\": \"2025-10-13 00:00:00\", \"combustible\": false, \"sucursal_id\": 8, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 12:01:39','2025-10-14 12:01:39'),
(113,6,'App\\Models\\Reclamo',56,'deleted','{\"attributes\": {\"id\": 56, \"pagado\": false, \"status\": \"en_proceso\", \"detalle\": \"xzczxvv\", \"agente_id\": 2, \"creator_id\": null, \"fecha_alta\": \"2025-10-05T00:00:00.000000Z\", \"persona_id\": 153, \"reclamo_type_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 12:14:10','2025-10-14 12:14:10'),
(114,6,'App\\Models\\Persona',185,'updated','{\"new\": {\"cbu_alias\": \"9999999999999999999997\"}, \"old\": {\"cbu_alias\": \"9999999999999999999999\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 12:19:42','2025-10-14 12:19:42'),
(115,6,'App\\Models\\Persona',178,'updated','{\"new\": {\"cbu_alias\": \"0070704830004001928328\"}, \"old\": {\"cbu_alias\": null}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 12:32:16','2025-10-14 12:32:16'),
(116,6,'App\\Models\\Persona',171,'updated','{\"new\": {\"cbu_alias\": \"1910274855127402360467\"}, \"old\": {\"cbu_alias\": \"19102748-55127402360467\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 12:40:03','2025-10-14 12:40:03'),
(117,6,'App\\Models\\Persona',171,'updated','{\"new\": {\"cbu_alias\": \"1910274855127402360467\"}, \"old\": {\"cbu_alias\": \"1910274855127402360468\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 12:41:59','2025-10-14 12:41:59'),
(118,18,'App\\Models\\Archivo',75,'created','{\"attributes\": {\"id\": 75, \"disk\": \"supabase\", \"mime\": \"image/jpeg\", \"ruta\": \"public/documentos/f_68ee4dc53f9536.84357398.jpg\", \"size\": 130939, \"carpeta\": \"reclamos\", \"persona_id\": 61, \"download_url\": \"https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ee4dc53f9536.84357398.jpg\", \"nombre_original\": \"1669d086-0edd-4700-9b8c-ea070b959b4e.jpg\", \"tipo_archivo_id\": 1}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 13:19:02','2025-10-14 13:19:02'),
(119,18,'App\\Models\\Archivo',76,'created','{\"attributes\": {\"id\": 76, \"disk\": \"supabase\", \"mime\": \"image/jpeg\", \"ruta\": \"public/documentos/f_68ee4dc75a2231.46425242.jpg\", \"size\": 96333, \"carpeta\": \"reclamos\", \"persona_id\": 61, \"download_url\": \"https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ee4dc75a2231.46425242.jpg\", \"nombre_original\": \"af1a47b3-f733-4288-9f7a-b2ffc3259258.jpg\", \"tipo_archivo_id\": 1}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 13:19:03','2025-10-14 13:19:03'),
(120,18,'App\\Models\\Reclamo',59,'created','{\"attributes\": {\"id\": 59, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Liquidacion-URBANO-  CORDOBA : El distribuidor De cordoba esta reclamando 12 mil pesos que fue mal liquidado  del dia 26/06   y del dia 25/08/2025 tambien indica que estaria mal liquidado ya que le facturaron 130.932,63  y el tramito 182.651,02, desde ya muchas gracias\", \"agente_id\": \"2\", \"persona_id\": 61, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 13:19:09','2025-10-14 13:19:09'),
(121,18,'App\\Models\\ReclamoComment',185,'created','{\"attributes\": {\"id\": 185, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 59, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 13:19:10','2025-10-14 13:19:10'),
(122,2,'App\\Models\\ReclamoComment',186,'created','{\"attributes\": {\"id\": 186, \"message\": \"mail :   Provisión 2da QUINCENA AGOSTO 25 - UEA CDO\\nse paso solicitacion revisio del dia 25\", \"creator_id\": 2, \"reclamo_id\": 59, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:47:39','2025-10-14 17:47:39'),
(123,2,'App\\Models\\ReclamoComment',187,'created','{\"attributes\": {\"id\": 187, \"message\": \"la hoja del dia reclamo dice 23-6 y se reclama el 26-6. Favor de ver si es el dia o la hoja para reclamar. Aguardo confirmacion\", \"creator_id\": 2, \"reclamo_id\": 59, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:49:20','2025-10-14 17:49:20'),
(124,2,'App\\Models\\ReclamoComment',188,'created','{\"attributes\": {\"id\": 188, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 59, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:49:24','2025-10-14 17:49:24'),
(125,2,'App\\Models\\Reclamo',59,'updated','{\"new\": {\"status\": \"en_proceso\"}, \"old\": {\"status\": \"creado\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:49:24','2025-10-14 17:49:24'),
(126,2,'App\\Models\\Reclamo',59,'updated','{\"new\": {\"agente_id\": 18}, \"old\": {\"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:49:42','2025-10-14 17:49:42'),
(127,2,'App\\Models\\ReclamoComment',189,'created','{\"attributes\": {\"id\": 189, \"message\": \"CASO 047349\\nse paso el reclamo\", \"creator_id\": 2, \"reclamo_id\": 57, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:58:30','2025-10-14 17:58:30'),
(128,2,'App\\Models\\ReclamoComment',190,'created','{\"attributes\": {\"id\": 190, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 57, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:58:39','2025-10-14 17:58:39'),
(129,2,'App\\Models\\Reclamo',57,'updated','{\"new\": {\"status\": \"en_proceso\"}, \"old\": {\"status\": \"creado\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 17:58:39','2025-10-14 17:58:39'),
(130,2,'App\\Models\\ReclamoComment',191,'created','{\"attributes\": {\"id\": 191, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 37, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:17:01','2025-10-14 18:17:01'),
(131,2,'App\\Models\\Reclamo',37,'updated','{\"new\": {\"status\": \"en_proceso\", \"agente_id\": 18}, \"old\": {\"status\": \"creado\", \"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:17:01','2025-10-14 18:17:01'),
(132,2,'App\\Models\\ReclamoComment',192,'created','{\"attributes\": {\"id\": 192, \"message\": \"la empresa comenta que el distribuidor debe reclamar a la otra empresa que se abono\", \"creator_id\": 2, \"reclamo_id\": 40, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:17:57','2025-10-14 18:17:57'),
(133,2,'App\\Models\\ReclamoComment',193,'created','{\"attributes\": {\"id\": 193, \"message\": \"Estado cambiado de creado a rechazado\", \"creator_id\": null, \"reclamo_id\": 40, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:18:05','2025-10-14 18:18:05'),
(134,2,'App\\Models\\Reclamo',40,'updated','{\"new\": {\"status\": \"rechazado\"}, \"old\": {\"status\": \"creado\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:18:05','2025-10-14 18:18:05'),
(135,6,'App\\Models\\Persona',186,'created','{\"attributes\": {\"id\": 186, \"cuil\": \"1\", \"pago\": 0, \"tipo\": 1, \"email\": \"velasquezemilianoagustin@gmail.com\", \"nombres\": \"Emiliano Agustin\", \"patente\": \"TGT630\", \"telefono\": \"3517525858\", \"agente_id\": 11, \"apellidos\": \"Velazquez\", \"cbu_alias\": \"1\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 3, \"fecha_alta\": \"2025-06-12 00:00:00\", \"combustible\": false, \"sucursal_id\": 274, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 18:22:35','2025-10-14 18:22:35'),
(136,6,'App\\Models\\Persona',87,'updated','{\"new\": {\"patente\": \"FED891\"}, \"old\": {\"patente\": \"EOV573\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 18:23:22','2025-10-14 18:23:22'),
(137,2,'App\\Models\\ReclamoComment',194,'created','{\"attributes\": {\"id\": 194, \"message\": \"se paso a la prefactura 526791 , se comento para el control, se aguarda su corroboracion para la gestion\", \"creator_id\": 2, \"reclamo_id\": 39, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:25:24','2025-10-14 18:25:24'),
(138,2,'App\\Models\\ReclamoComment',195,'created','{\"attributes\": {\"id\": 195, \"message\": \"Estado cambiado de creado a en proceso\", \"creator_id\": null, \"reclamo_id\": 39, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:25:55','2025-10-14 18:25:55'),
(139,2,'App\\Models\\Reclamo',39,'updated','{\"new\": {\"status\": \"en_proceso\"}, \"old\": {\"status\": \"creado\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:25:55','2025-10-14 18:25:55'),
(140,2,'App\\Models\\Reclamo',39,'updated','{\"new\": {\"agente_id\": 11}, \"old\": {\"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 18:25:57','2025-10-14 18:25:57'),
(141,6,'App\\Models\\Persona',187,'created','{\"attributes\": {\"id\": 187, \"cuil\": \"1\", \"pago\": 0, \"tipo\": 1, \"email\": \"maximo.patron2003@gmail.com\", \"nombres\": \"Maximo\", \"patente\": \"EOV753\", \"telefono\": \"3513256553\", \"agente_id\": 8, \"apellidos\": \"Patron\", \"cbu_alias\": \"1\", \"estado_id\": 1, \"unidad_id\": 2, \"cliente_id\": 3, \"fecha_alta\": null, \"combustible\": true, \"sucursal_id\": 274, \"observaciones\": null, \"tarifaespecial\": 0, \"observaciontarifa\": null}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-14 18:28:20','2025-10-14 18:28:20'),
(142,2,'App\\Models\\ReclamoComment',196,'created','{\"attributes\": {\"id\": 196, \"message\": \"se reconocio los dias, el dia 1, comentan que no tienen registro (no hizo servicio) la hoja de ese dia tampoco se paso, si realizo pasar, aguardo confirmacion\", \"creator_id\": 2, \"reclamo_id\": 38, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 19:03:28','2025-10-14 19:03:28'),
(143,2,'App\\Models\\Reclamo',38,'updated','{\"new\": {\"agente_id\": 18}, \"old\": {\"agente_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 19:03:39','2025-10-14 19:03:39'),
(144,2,'App\\Models\\ReclamoComment',197,'created','{\"attributes\": {\"id\": 197, \"message\": \"aclaro de la primera quincena de agosto\", \"creator_id\": 2, \"reclamo_id\": 38, \"sender_type\": \"agente\", \"sender_user_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-14 19:04:22','2025-10-14 19:04:22'),
(145,18,'App\\Models\\Archivo',77,'created','{\"attributes\": {\"id\": 77, \"disk\": \"supabase\", \"mime\": \"image/jpeg\", \"ruta\": \"public/documentos/f_68ef8dd96b6f49.95971139.jpg\", \"size\": 7251, \"carpeta\": \"reclamos\", \"persona_id\": 187, \"download_url\": \"https://tigmyspvafopmsxthkvi.supabase.co/storage/v1/object/public/archivos/public/documentos/f_68ef8dd96b6f49.95971139.jpg\", \"nombre_original\": \"logistica.jpg\", \"tipo_archivo_id\": 1}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:04:42','2025-10-15 12:04:42'),
(146,18,'App\\Models\\Reclamo',60,'created','{\"attributes\": {\"id\": 60, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"gdsgsdgsdg\", \"agente_id\": \"2\", \"persona_id\": 187, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:04:49','2025-10-15 12:04:49'),
(147,18,'App\\Models\\ReclamoComment',198,'created','{\"attributes\": {\"id\": 198, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 60, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:04:49','2025-10-15 12:04:49'),
(148,2,'App\\Models\\Reclamo',60,'deleted','{\"attributes\": {\"id\": 60, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"gdsgsdgsdg\", \"agente_id\": 2, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 187, \"reclamo_type_id\": 2}}','190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','2025-10-15 12:05:23','2025-10-15 12:05:23'),
(149,18,'App\\Models\\Reclamo',61,'created','{\"attributes\": {\"id\": 61, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo de prueba desde curl con autenticación\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:09:44','2025-10-15 12:09:44'),
(150,18,'App\\Models\\ReclamoComment',199,'created','{\"attributes\": {\"id\": 199, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 61, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:09:44','2025-10-15 12:09:44'),
(151,18,'App\\Models\\Reclamo',62,'created','{\"attributes\": {\"id\": 62, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo de prueba con auth(sanctum)\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:12:03','2025-10-15 12:12:03'),
(152,18,'App\\Models\\ReclamoComment',200,'created','{\"attributes\": {\"id\": 200, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 62, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:12:03','2025-10-15 12:12:03'),
(153,18,'App\\Models\\Reclamo',63,'created','{\"attributes\": {\"id\": 63, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo test después de agregar sanctum guard\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:30:10','2025-10-15 12:30:10'),
(154,18,'App\\Models\\ReclamoComment',201,'created','{\"attributes\": {\"id\": 201, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 63, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:30:10','2025-10-15 12:30:10'),
(155,18,'App\\Models\\Reclamo',64,'created','{\"attributes\": {\"id\": 64, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo forzado con guard Sanctum\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:34:18','2025-10-15 12:34:18'),
(156,18,'App\\Models\\ReclamoComment',202,'created','{\"attributes\": {\"id\": 202, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 64, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:34:18','2025-10-15 12:34:18'),
(157,18,'App\\Models\\Reclamo',65,'created','{\"attributes\": {\"id\": 65, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo después de restaurar Kernel.php\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:39:33','2025-10-15 12:39:33'),
(158,18,'App\\Models\\ReclamoComment',203,'created','{\"attributes\": {\"id\": 203, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 65, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:39:33','2025-10-15 12:39:33'),
(159,18,'App\\Models\\Reclamo',66,'created','{\"attributes\": {\"id\": 66, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo final con creator_id\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:51:06','2025-10-15 12:51:06'),
(160,18,'App\\Models\\ReclamoComment',204,'created','{\"attributes\": {\"id\": 204, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 66, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:51:06','2025-10-15 12:51:06'),
(161,18,'App\\Models\\Reclamo',67,'created','{\"attributes\": {\"id\": 67, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo final con creator_id\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:52:16','2025-10-15 12:52:16'),
(162,18,'App\\Models\\ReclamoComment',205,'created','{\"attributes\": {\"id\": 205, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 67, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:52:16','2025-10-15 12:52:16'),
(163,18,'App\\Models\\Reclamo',68,'created','{\"attributes\": {\"id\": 68, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con creator_id después del Kernel\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:54:54','2025-10-15 12:54:54'),
(164,18,'App\\Models\\ReclamoComment',206,'created','{\"attributes\": {\"id\": 206, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 68, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:54:54','2025-10-15 12:54:54'),
(165,6,'App\\Models\\Reclamo',61,'deleted','{\"attributes\": {\"id\": 61, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo de prueba desde curl con autenticación\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:55:41','2025-10-15 12:55:41'),
(166,6,'App\\Models\\Reclamo',62,'deleted','{\"attributes\": {\"id\": 62, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo de prueba con auth(sanctum)\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:55:48','2025-10-15 12:55:48'),
(167,6,'App\\Models\\Reclamo',63,'deleted','{\"attributes\": {\"id\": 63, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo test después de agregar sanctum guard\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:55:50','2025-10-15 12:55:50'),
(168,6,'App\\Models\\Reclamo',65,'deleted','{\"attributes\": {\"id\": 65, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo después de restaurar Kernel.php\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:55:53','2025-10-15 12:55:53'),
(169,6,'App\\Models\\Reclamo',68,'deleted','{\"attributes\": {\"id\": 68, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con creator_id después del Kernel\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:55:58','2025-10-15 12:55:58'),
(170,6,'App\\Models\\Reclamo',67,'deleted','{\"attributes\": {\"id\": 67, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo final con creator_id\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:56:01','2025-10-15 12:56:01'),
(171,6,'App\\Models\\Reclamo',66,'deleted','{\"attributes\": {\"id\": 66, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo final con creator_id\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:56:05','2025-10-15 12:56:05'),
(172,6,'App\\Models\\Reclamo',64,'deleted','{\"attributes\": {\"id\": 64, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo forzado con guard Sanctum\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:56:08','2025-10-15 12:56:08'),
(173,6,'App\\Models\\Reclamo',69,'created','{\"attributes\": {\"id\": 69, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"zrgrstesry\", \"agente_id\": \"22\", \"fecha_alta\": \"2025-10-15 00:00:00\", \"persona_id\": 185, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:56:41','2025-10-15 12:56:41'),
(174,6,'App\\Models\\ReclamoComment',207,'created','{\"attributes\": {\"id\": 207, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 69, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 12:56:42','2025-10-15 12:56:42'),
(175,18,'App\\Models\\Reclamo',70,'created','{\"attributes\": {\"id\": 70, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con creator_id OK\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 12:59:32','2025-10-15 12:59:32'),
(176,18,'App\\Models\\ReclamoComment',208,'created','{\"attributes\": {\"id\": 208, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 70, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 12:59:32','2025-10-15 12:59:32'),
(177,18,'App\\Models\\Reclamo',71,'created','{\"attributes\": {\"id\": 71, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con creator_id funcionando\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 13:03:04','2025-10-15 13:03:04'),
(178,18,'App\\Models\\ReclamoComment',209,'created','{\"attributes\": {\"id\": 209, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 71, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 13:03:04','2025-10-15 13:03:04'),
(179,18,'App\\Models\\Reclamo',72,'created','{\"attributes\": {\"id\": 72, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con Sanctum activo\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 13:06:58','2025-10-15 13:06:58'),
(180,18,'App\\Models\\ReclamoComment',210,'created','{\"attributes\": {\"id\": 210, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 72, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 13:06:58','2025-10-15 13:06:58'),
(181,18,'App\\Models\\Reclamo',73,'created','{\"attributes\": {\"id\": 73, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con Sanctum OK y creator_id\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 13:09:21','2025-10-15 13:09:21'),
(182,18,'App\\Models\\ReclamoComment',211,'created','{\"attributes\": {\"id\": 211, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 73, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 13:09:21','2025-10-15 13:09:21'),
(183,18,'App\\Models\\Reclamo',74,'created','{\"attributes\": {\"id\": 74, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con Auth::shouldUse funcionando\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 13:12:11','2025-10-15 13:12:11'),
(184,18,'App\\Models\\ReclamoComment',212,'created','{\"attributes\": {\"id\": 212, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 74, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 13:12:11','2025-10-15 13:12:11'),
(185,18,'App\\Models\\Reclamo',75,'created','{\"attributes\": {\"id\": 75, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo tras registrar Kernel y middleware\", \"persona_id\": 61, \"reclamo_type_id\": 1}}','127.0.0.1','curl/8.5.0','2025-10-15 13:16:27','2025-10-15 13:16:27'),
(186,18,'App\\Models\\ReclamoComment',213,'created','{\"attributes\": {\"id\": 213, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 75, \"sender_type\": \"sistema\"}}','127.0.0.1','curl/8.5.0','2025-10-15 13:16:27','2025-10-15 13:16:27'),
(187,6,'App\\Models\\Reclamo',75,'deleted','{\"attributes\": {\"id\": 75, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo tras registrar Kernel y middleware\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:17:35','2025-10-15 13:17:35'),
(188,6,'App\\Models\\Reclamo',74,'deleted','{\"attributes\": {\"id\": 74, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con Auth::shouldUse funcionando\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:17:38','2025-10-15 13:17:38'),
(189,6,'App\\Models\\Reclamo',73,'deleted','{\"attributes\": {\"id\": 73, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con Sanctum OK y creator_id\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:17:40','2025-10-15 13:17:40'),
(190,6,'App\\Models\\Reclamo',72,'deleted','{\"attributes\": {\"id\": 72, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con Sanctum activo\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:17:45','2025-10-15 13:17:45'),
(191,6,'App\\Models\\Reclamo',71,'deleted','{\"attributes\": {\"id\": 71, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con creator_id funcionando\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:17:48','2025-10-15 13:17:48'),
(192,6,'App\\Models\\Reclamo',70,'deleted','{\"attributes\": {\"id\": 70, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"Reclamo con creator_id OK\", \"agente_id\": null, \"creator_id\": null, \"fecha_alta\": null, \"persona_id\": 61, \"reclamo_type_id\": 1}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:17:58','2025-10-15 13:17:58'),
(193,6,'App\\Models\\Reclamo',69,'deleted','{\"attributes\": {\"id\": 69, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"zrgrstesry\", \"agente_id\": 22, \"creator_id\": null, \"fecha_alta\": \"2025-10-15T00:00:00.000000Z\", \"persona_id\": 185, \"reclamo_type_id\": 2}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:18:00','2025-10-15 13:18:00'),
(194,6,'App\\Models\\Reclamo',76,'created','{\"attributes\": {\"id\": 76, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"rthrtdhgdhdfgh\", \"agente_id\": \"22\", \"fecha_alta\": \"2025-10-15 00:00:00\", \"persona_id\": 185, \"reclamo_type_id\": \"2\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:18:21','2025-10-15 13:18:21'),
(195,6,'App\\Models\\ReclamoComment',214,'created','{\"attributes\": {\"id\": 214, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 76, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:18:22','2025-10-15 13:18:22'),
(196,6,'App\\Models\\Reclamo',77,'created','{\"attributes\": {\"id\": 77, \"pagado\": false, \"status\": \"creado\", \"detalle\": \"kjhvfjmhv\", \"agente_id\": \"22\", \"persona_id\": 185, \"reclamo_type_id\": \"4\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:33:21','2025-10-15 13:33:21'),
(197,6,'App\\Models\\ReclamoComment',215,'created','{\"attributes\": {\"id\": 215, \"meta\": \"{\\\"status\\\":\\\"creado\\\"}\", \"message\": \"Reclamo creado inicialmente\", \"creator_id\": null, \"reclamo_id\": 77, \"sender_type\": \"sistema\"}}','190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-15 13:33:22','2025-10-15 13:33:22'),
(198,NULL,'App\\Models\\User',6,'updated','{\"old\":{\"password\":\"$2y$12$f1IPfqrsb9hi4YtzwT\\/8w.pDKW\\/YPRRDQ.4WeKGci6TXAl.PA91a.\"},\"new\":{\"password\":\"$2y$12$vadrmpqxhjOHfiQb3TTfVel2wfCGHWwHyJpQoRLp0RQRUadL9pVSm\"}}','127.0.0.1','Symfony','2025-10-16 02:26:58','2025-10-16 02:26:58'),
(199,6,'App\\Models\\Reclamo',78,'created','{\"attributes\":{\"persona_id\":185,\"agente_id\":\"22\",\"reclamo_type_id\":\"4\",\"detalle\":\"ddgsrgsfdgsdfg\",\"fecha_alta\":\"2025-10-16 00:00:00\",\"pagado\":false,\"status\":\"creado\",\"id\":78}}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-16 02:51:52','2025-10-16 02:51:52'),
(200,6,'App\\Models\\ReclamoComment',216,'created','{\"attributes\":{\"reclamo_id\":78,\"creator_id\":null,\"sender_type\":\"sistema\",\"message\":\"Reclamo creado inicialmente\",\"meta\":\"{\\\"status\\\":\\\"creado\\\"}\",\"id\":216}}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-16 02:51:52','2025-10-16 02:51:52'),
(201,4,'App\\Models\\Reclamo',79,'created','{\"attributes\":{\"persona_id\":185,\"agente_id\":\"18\",\"reclamo_type_id\":\"4\",\"detalle\":\"ergdsfdgsd\",\"fecha_alta\":\"2025-10-15 00:00:00\",\"pagado\":false,\"status\":\"creado\",\"id\":79}}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-16 04:49:19','2025-10-16 04:49:19'),
(202,4,'App\\Models\\ReclamoComment',217,'created','{\"attributes\":{\"reclamo_id\":79,\"creator_id\":null,\"sender_type\":\"sistema\",\"message\":\"Reclamo creado inicialmente\",\"meta\":\"{\\\"status\\\":\\\"creado\\\"}\",\"id\":217}}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-16 04:49:19','2025-10-16 04:49:19'),
(203,6,'App\\Models\\Reclamo',80,'created','{\"attributes\":{\"persona_id\":185,\"agente_id\":\"12\",\"reclamo_type_id\":\"4\",\"detalle\":\"rtrgretg\",\"pagado\":false,\"status\":\"creado\",\"id\":80}}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-16 05:32:13','2025-10-16 05:32:13'),
(204,6,'App\\Models\\ReclamoComment',218,'created','{\"attributes\":{\"reclamo_id\":80,\"creator_id\":null,\"sender_type\":\"sistema\",\"message\":\"Reclamo creado inicialmente\",\"meta\":\"{\\\"status\\\":\\\"creado\\\"}\",\"id\":218}}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','2025-10-16 05:32:13','2025-10-16 05:32:13');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `codigo` text DEFAULT NULL,
  `nombre` text DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `documento_fiscal` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES
(1,'1','Urbano Express','1111','20000','2025-09-15 14:36:42','2025-09-16 16:34:45','2025-09-16 16:34:45'),
(2,'2','OCASA','1111','20000','2025-09-15 17:13:00','2025-09-18 11:57:15','2025-09-18 11:57:15'),
(3,'3','Loginter','444564','654654','2025-09-15 17:13:57','2025-09-15 17:13:57',NULL),
(4,'4','QX','21654654','54654654','2025-09-15 18:22:25','2025-09-15 18:22:25',NULL),
(13,'1','Urbano Express','asfsafasf','321321564','2025-09-16 16:57:54','2025-09-16 16:57:54',NULL),
(14,'5','OCASA','21654654','21654654','2025-09-17 12:59:12','2025-09-17 12:59:12',NULL),
(15,'3183','Amir Lozada','Musipan calle principal','5391415','2025-09-29 02:26:17','2025-09-30 11:36:55','2025-09-30 11:36:55'),
(16,'6','OCA','OCa','22154','2025-10-01 14:33:58','2025-10-04 02:53:29','2025-10-04 02:53:29'),
(17,'78555','Alonso Coa','Los tapiales calle 5','748596','2025-10-04 02:53:00','2025-10-06 11:34:32','2025-10-06 11:34:32');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `duenos`
--

DROP TABLE IF EXISTS `duenos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `duenos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` bigint(20) unsigned NOT NULL,
  `nombreapellido` varchar(255) DEFAULT 'Sin nombre',
  `fecha_nacimiento` date DEFAULT NULL,
  `cuil` varchar(255) DEFAULT NULL,
  `cuil_cobrador` varchar(255) DEFAULT NULL,
  `cbu_alias` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `duenos_persona_id_foreign` (`persona_id`),
  CONSTRAINT `duenos_persona_id_foreign` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `duenos`
--

LOCK TABLES `duenos` WRITE;
/*!40000 ALTER TABLE `duenos` DISABLE KEYS */;
INSERT INTO `duenos` VALUES
(1,18,'Sin nombre','2025-01-01','20319114816','20319114816','0170330440000044873930','1@gmail.com','1',NULL,'2025-09-23 11:49:48','2025-09-23 11:49:48',NULL),
(2,20,'Sin nombre','2020-08-12','Dolores mollit commo','Commodi iste ea et a','Nihil quas sunt iure','bijy@mailinator.com','14927327146','Accusantium omnis cu','2025-09-23 14:15:34','2025-09-23 14:15:34',NULL),
(3,22,'Albert Charmelo','1989-11-12','Aut ea dolorem et re','Aspernatur incididun','Aut a pariatur In l','cuzohaze@mailinator.com','15517461767','Debitis laboriosam','2025-09-23 14:44:21','2025-09-23 14:47:19',NULL),
(4,29,'Gerardo Luis Giordano','1983-07-16','20299917828','20299917828','0110501830050172861551','gerardoluisgiordano@gmail.com','3425107106',NULL,'2025-09-23 15:55:10','2025-09-23 15:55:10',NULL),
(5,32,'Ojeda Alfredo','2025-01-01','20402601753','1','1','martinezlopezmarialaura78@gmail.com','3794342560',NULL,'2025-09-24 12:13:53','2025-09-24 12:13:53',NULL),
(6,43,'German Benitez','2025-01-01','20301020652','20301020652','0150969801000009623784','g3rmi@hotmail.com','1231',NULL,'2025-09-24 14:49:46','2025-09-24 14:49:46',NULL),
(7,64,'battau','2025-01-01','1','1','1','1@gmail.com','1',NULL,'2025-09-25 17:49:48','2025-09-25 17:49:48',NULL),
(8,77,'Aranibe Matias',NULL,'20345333518','20345333518','0720175888000002864518','translogisticrm@gmail.com','1',NULL,'2025-09-30 11:55:53','2025-09-30 11:55:53',NULL),
(9,81,'Horacio Mareque',NULL,'20261157021','20261157021','0720180288000022226736','javierbuccella@gmail.com','1',NULL,'2025-09-30 12:24:19','2025-09-30 12:24:19',NULL),
(10,85,'Casse Norma Ester',NULL,'27175521726','27175521726','3860198305000040010923','Gonzalez.lm65@gmail.com','1',NULL,'2025-09-30 12:44:43','2025-09-30 12:44:43',NULL),
(11,89,'Lenis Tomas Agustin',NULL,'20414106782','20414106782','0170247940000004664349','1@gmail.com','1',NULL,'2025-09-30 13:36:13','2025-09-30 13:36:13',NULL),
(12,96,'preguntar',NULL,'27375773223','27375773223','efectivo','Marianogibarra@hotmail.com','1',NULL,'2025-09-30 15:07:29','2025-09-30 15:07:29',NULL),
(13,98,'Zotes Diego',NULL,'20278037399','20278037399','0000003100088513661417','1@gmail.com','1',NULL,'2025-09-30 15:28:38','2025-09-30 15:28:38',NULL),
(14,111,'Nicolas Casorati',NULL,'20312439108','20312439108','0070682330004004741483','nicolas.casorati@gmail.com','1126243564',NULL,'2025-10-01 12:02:40','2025-10-01 12:02:40',NULL),
(15,117,'Meloni Hugo',NULL,'20132663816','20132663816','0000003100025633074448','transportemeloni@gmail.com','1','Ya esta trabajando en OCA fecha de alta 06/08/2025','2025-10-01 14:39:49','2025-10-01 14:39:49',NULL),
(16,125,'Gonzalo Nahuel Nievas','1992-01-19','20366925547','33716733209','0070147720000000323860','adm-3k@hotmail.com','2995220931',NULL,'2025-10-01 19:07:37','2025-10-01 19:07:37',NULL),
(17,141,'Naiara Maria Genzano','1998-08-10','27413250027','27213406650','0070121730004188146951','naigenzano@gmail.com','2477455829',NULL,'2025-10-02 13:26:15','2025-10-02 13:26:15',NULL),
(18,160,'Hernan Rene Jaimes','1978-12-20','20315711208','20315711208','0720371688000036154872','hernanjaimes85@gmail.com','3416436529',NULL,'2025-10-13 13:48:40','2025-10-13 13:48:40',NULL),
(19,164,'Tomas Alejandro Gonzalez','1999-04-16','20416559350','20416559350','0720371688000002236168','tomasajgonzalez@gmail.com','3413626585',NULL,'2025-10-13 14:10:24','2025-10-13 14:10:24',NULL);
/*!40000 ALTER TABLE `duenos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estados`
--

DROP TABLE IF EXISTS `estados`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `estados` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estados`
--

LOCK TABLES `estados` WRITE;
/*!40000 ALTER TABLE `estados` DISABLE KEYS */;
INSERT INTO `estados` VALUES
(1,'Activo','2025-09-11 12:17:30',NULL,NULL),
(2,'Baja','2025-09-11 12:17:45',NULL,NULL),
(3,'Suspendido','2025-09-11 12:17:58',NULL,NULL),
(4,'Realizado','2025-09-11 12:18:03',NULL,NULL);
/*!40000 ALTER TABLE `estados` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fyle_types`
--

DROP TABLE IF EXISTS `fyle_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fyle_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) DEFAULT NULL,
  `vence` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fyle_types`
--

LOCK TABLES `fyle_types` WRITE;
/*!40000 ALTER TABLE `fyle_types` DISABLE KEYS */;
INSERT INTO `fyle_types` VALUES
(1,'Poliza',1,'2025-09-15 14:33:49','2025-09-15 14:33:49',NULL),
(2,'DNI',0,'2025-09-15 14:34:00','2025-09-15 14:34:00',NULL),
(3,'RTO',1,'2025-09-15 17:14:17','2025-09-15 17:14:17',NULL),
(4,'Carnet de Conducir',1,'2025-09-15 17:14:35','2025-09-15 17:14:35',NULL),
(5,'Cedula verde',0,'2025-09-15 17:14:43','2025-09-15 17:14:43',NULL),
(6,'Tutulo de la unidad',0,'2025-09-15 17:14:59','2025-09-15 17:14:59',NULL),
(7,'Contrato',0,'2025-09-15 17:15:09','2025-09-15 17:15:09',NULL),
(8,'Prorroga Poliza',1,'2025-09-15 18:35:31','2025-09-15 18:35:31',NULL),
(9,'prueba',1,'2025-10-09 16:13:45','2025-10-09 16:13:45',NULL);
/*!40000 ALTER TABLE `fyle_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
INSERT INTO `jobs` VALUES
(45,'default','{\"uuid\":\"8673c961-751d-46e7-b0db-8ec77a45462e\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:13;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:23;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758554697,\"delay\":null}',0,NULL,1758554697,1758554697),
(46,'default','{\"uuid\":\"698db395-3c98-4b0d-97e8-930e980ceb0f\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:55;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758554849,\"delay\":null}',0,NULL,1758554849,1758554849),
(47,'default','{\"uuid\":\"385f4495-25b1-45ea-be98-e8949fdbaaf2\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:56;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758554887,\"delay\":null}',0,NULL,1758554887,1758554887),
(48,'default','{\"uuid\":\"594d3517-cf20-4bf5-9a46-127662625ced\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:13;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758555136,\"delay\":null}',0,NULL,1758555136,1758555136),
(49,'default','{\"uuid\":\"b318d741-fc09-40ec-96dc-621ee1f592dc\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:13;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:10:\\\"en_proceso\\\";s:3:\\\"new\\\";s:11:\\\"solucionado\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758555161,\"delay\":null}',0,NULL,1758555161,1758555161),
(50,'default','{\"uuid\":\"5f46af7e-219e-4353-a930-1d0ac2fcefab\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:15;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:24;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561015,\"delay\":null}',0,NULL,1758561015,1758561015),
(51,'default','{\"uuid\":\"07f1e010-50fd-4d19-bc6a-06c434be2d5d\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:61;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561029,\"delay\":null}',0,NULL,1758561029,1758561029),
(52,'default','{\"uuid\":\"8b0578da-a006-4443-abb1-a1692f604aff\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:15;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561033,\"delay\":null}',0,NULL,1758561033,1758561033),
(53,'default','{\"uuid\":\"3a2d78d3-7d4a-4129-bc52-348f7406db87\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:63;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561072,\"delay\":null}',0,NULL,1758561072,1758561072),
(54,'default','{\"uuid\":\"d14cf61c-4802-4553-99bb-b3ec8592247e\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:15;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:10:\\\"en_proceso\\\";s:3:\\\"new\\\";s:11:\\\"solucionado\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561091,\"delay\":null}',0,NULL,1758561091,1758561091),
(55,'default','{\"uuid\":\"12ef85e4-ee99-410e-86e7-6fa092a64e3b\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:65;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561105,\"delay\":null}',0,NULL,1758561105,1758561105),
(56,'default','{\"uuid\":\"ec50cc4e-fff3-4d43-9516-1a109afa9a43\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:66;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758561116,\"delay\":null}',0,NULL,1758561116,1758561116),
(57,'default','{\"uuid\":\"d473bbf6-f50f-44de-939e-47e32860543c\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:16;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:25;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562565,\"delay\":null}',0,NULL,1758562565,1758562565),
(58,'default','{\"uuid\":\"653db190-82cb-4c13-8b89-02a63c84451a\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:16;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562624,\"delay\":null}',0,NULL,1758562624,1758562624),
(59,'default','{\"uuid\":\"14868133-8457-4c46-a2a9-2ccca223f28a\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:69;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562644,\"delay\":null}',0,NULL,1758562644,1758562644),
(60,'default','{\"uuid\":\"df1be151-1a40-4efd-a9e6-b0dd30660abe\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:16;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:10:\\\"en_proceso\\\";s:3:\\\"new\\\";s:11:\\\"solucionado\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562678,\"delay\":null}',0,NULL,1758562678,1758562678),
(61,'default','{\"uuid\":\"ebd2f938-f16f-42d6-9149-b1a007ee346d\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:71;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562714,\"delay\":null}',0,NULL,1758562714,1758562714),
(62,'default','{\"uuid\":\"439cdf1c-691b-4c80-81c0-09dedf39dfab\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:72;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562948,\"delay\":null}',0,NULL,1758562948,1758562948),
(63,'default','{\"uuid\":\"a7bb95ca-ce4b-417c-bb3b-96870a00db2d\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:73;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562959,\"delay\":null}',0,NULL,1758562959,1758562959),
(64,'default','{\"uuid\":\"61623eca-b06a-4d4f-b6a8-32d750e729e8\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:74;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758562969,\"delay\":null}',0,NULL,1758562969,1758562969),
(65,'default','{\"uuid\":\"6de61fcd-8a28-4f79-b421-b9a2dc62ec2d\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:75;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758563042,\"delay\":null}',0,NULL,1758563042,1758563042),
(66,'default','{\"uuid\":\"d357b581-368d-47fb-94c0-8f0f81fd311d\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:15;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:26;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758563382,\"delay\":null}',0,NULL,1758563382,1758563382),
(67,'default','{\"uuid\":\"7f1779d8-ee5b-4302-9c8b-c0453d928489\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:17;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:27;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758566167,\"delay\":null}',0,NULL,1758566167,1758566167),
(68,'default','{\"uuid\":\"07f3d9b2-d5d5-4b46-a68d-135e9f6d12bb\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:17;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758566209,\"delay\":null}',0,NULL,1758566209,1758566209),
(69,'default','{\"uuid\":\"d55aa14f-47ec-4dc9-8d49-9694f0c1ed6a\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:78;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758566220,\"delay\":null}',0,NULL,1758566220,1758566220),
(70,'default','{\"uuid\":\"0861548a-0e8c-4679-b113-87f72c19395a\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:79;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758566286,\"delay\":null}',0,NULL,1758566286,1758566286),
(71,'default','{\"uuid\":\"e16cce1c-1598-45de-932d-e5937f771692\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:17;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:10:\\\"en_proceso\\\";s:3:\\\"new\\\";s:11:\\\"solucionado\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758566288,\"delay\":null}',0,NULL,1758566288,1758566288),
(72,'default','{\"uuid\":\"c041dbe9-1706-4050-b2ba-805e6db43337\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:81;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758566747,\"delay\":null}',0,NULL,1758566747,1758566747),
(73,'default','{\"uuid\":\"794bb5f1-aa95-4c05-a9dd-56bb653d3ea4\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:85;s:9:\\\"relations\\\";a:3:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758902342,\"delay\":null}',0,NULL,1758902342,1758902342),
(74,'default','{\"uuid\":\"c5ba1e91-d168-45c5-8cbe-686d7cb3ae8e\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:18;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758904817,\"delay\":null}',0,NULL,1758904817,1758904817),
(75,'default','{\"uuid\":\"2e939d67-293e-4153-b433-eea428b4b4f8\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:18;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:10:\\\"en_proceso\\\";s:3:\\\"new\\\";s:11:\\\"solucionado\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758904907,\"delay\":null}',0,NULL,1758904907,1758904907),
(76,'default','{\"uuid\":\"659a050d-841d-483e-b58b-479cb95959f0\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:18;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:28;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758966721,\"delay\":null}',0,NULL,1758966721,1758966721),
(77,'default','{\"uuid\":\"cc59e0ad-6a38-4d32-908b-cc6b13ce4dfc\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:90;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758969573,\"delay\":null}',0,NULL,1758969573,1758969573),
(78,'default','{\"uuid\":\"692d7b3d-aa97-4192-8cca-4ef05ca8f8b9\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:92;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1758970777,\"delay\":null}',0,NULL,1758970777,1758970777),
(79,'default','{\"uuid\":\"1356a9f8-2669-43eb-a9ae-fd70c9723243\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:30;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:29;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112201,\"delay\":null}',0,NULL,1759112201,1759112201),
(80,'default','{\"uuid\":\"dcb6d613-d36d-479a-bc80-237bfe199e37\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:30;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:30;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112228,\"delay\":null}',0,NULL,1759112228,1759112228),
(81,'default','{\"uuid\":\"233ec079-fc8a-4d12-bdfc-7a0396c76a4a\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:30;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:31;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112240,\"delay\":null}',0,NULL,1759112240,1759112240),
(82,'default','{\"uuid\":\"33a5b3e9-6cbd-4fed-ae83-87b2c46a5754\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:30;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112335,\"delay\":null}',0,NULL,1759112335,1759112335),
(83,'default','{\"uuid\":\"ddec7056-00a9-4468-a7cb-60374d35f0c6\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:20;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112359,\"delay\":null}',0,NULL,1759112359,1759112359),
(84,'default','{\"uuid\":\"9375e7bc-34fe-471f-8a66-fc81611ef284\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:31;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:32;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112594,\"delay\":null}',0,NULL,1759112594,1759112594),
(85,'default','{\"uuid\":\"2a923aec-7805-4a2a-b8f7-7a17b933a663\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:31;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759112607,\"delay\":null}',0,NULL,1759112607,1759112607),
(86,'default','{\"uuid\":\"e37b9cb6-9020-4b45-9cc6-d6c2e687c834\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:32;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:3:{i:0;i:33;i:1;i:34;i:2;i:35;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759169457,\"delay\":null}',0,NULL,1759169457,1759169457),
(87,'default','{\"uuid\":\"c6dbf3ff-ab40-4a52-96c4-340f57d9c37a\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:32;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759169486,\"delay\":null}',0,NULL,1759169486,1759169486),
(88,'default','{\"uuid\":\"dbb6e11e-d6a8-42e9-ad5c-f22187884096\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:101;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759232167,\"delay\":null}',0,NULL,1759232167,1759232167),
(89,'default','{\"uuid\":\"bdec8cd7-cb12-4bf5-acaa-d212bf6c3cea\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:33;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759232183,\"delay\":null}',0,NULL,1759232183,1759232183),
(90,'default','{\"uuid\":\"f7f540a6-1a54-4ebb-8234-acb492ff42e3\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:35;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:36;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759256204,\"delay\":null}',0,NULL,1759256204,1759256204),
(91,'default','{\"uuid\":\"837c6569-75d0-4879-a673-13a1db7cc44b\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:105;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759256219,\"delay\":null}',0,NULL,1759256219,1759256219),
(92,'default','{\"uuid\":\"94d0145a-8841-4d0a-baef-76f23830fc42\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:36;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:2:{i:0;i:37;i:1;i:38;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759328844,\"delay\":null}',0,NULL,1759328844,1759328844),
(93,'default','{\"uuid\":\"11530dc1-d843-4bdc-9d70-26ce1903c295\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:39;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:39;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759330493,\"delay\":null}',0,NULL,1759330493,1759330493),
(94,'default','{\"uuid\":\"bf47f51f-8bd6-4547-bdfb-1552d0199267\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:36;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759338556,\"delay\":null}',0,NULL,1759338556,1759338556),
(95,'default','{\"uuid\":\"a79588be-fed1-439c-8e23-b587710be577\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:40;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:8:{i:0;i:40;i:1;i:41;i:2;i:42;i:3;i:43;i:4;i:44;i:5;i:45;i:6;i:46;i:7;i:47;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759340214,\"delay\":null}',0,NULL,1759340214,1759340214),
(96,'default','{\"uuid\":\"8067927a-794e-415b-a684-149a4ab9c69c\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:41;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:4:{i:0;i:48;i:1;i:49;i:2;i:50;i:3;i:51;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759406295,\"delay\":null}',0,NULL,1759406295,1759406295),
(97,'default','{\"uuid\":\"11e5fe6b-5fca-439c-b43b-980b63fe3d2b\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:113;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759426259,\"delay\":null}',0,NULL,1759426259,1759426259),
(98,'default','{\"uuid\":\"305abfd3-9b66-4fd0-becd-017dbca9790d\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:41;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759426262,\"delay\":null}',0,NULL,1759426262,1759426262),
(99,'default','{\"uuid\":\"8ddea32e-8e2e-475c-bcef-4e876bc7a9a1\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:42;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:7:{i:0;i:52;i:1;i:53;i:2;i:54;i:3;i:55;i:4;i:56;i:5;i:57;i:6;i:58;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759431094,\"delay\":null}',0,NULL,1759431094,1759431094),
(100,'default','{\"uuid\":\"2e97ccaf-7baf-41c0-a102-92278e3a4609\",\"displayName\":\"App\\\\Events\\\\ReclamoFilesAttached\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoFilesAttached\\\":2:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:43;s:9:\\\"relations\\\";a:5:{i:0;s:7:\\\"persona\\\";i:1;s:6:\\\"agente\\\";i:2;s:7:\\\"creator\\\";i:3;s:4:\\\"tipo\\\";i:4;s:8:\\\"archivos\\\";}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:10:\\\"archivoIds\\\";a:1:{i:0;i:59;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759432321,\"delay\":null}',0,NULL,1759432321,1759432321),
(101,'default','{\"uuid\":\"24571fed-4179-49a4-8d9c-9d9745eee48d\",\"displayName\":\"App\\\\Events\\\\ReclamoCommentCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:32:\\\"App\\\\Events\\\\ReclamoCommentCreated\\\":1:{s:7:\\\"comment\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:25:\\\"App\\\\Models\\\\ReclamoComment\\\";s:2:\\\"id\\\";i:117;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759433704,\"delay\":null}',0,NULL,1759433704,1759433704),
(102,'default','{\"uuid\":\"fcb8900e-86a7-4a58-8c8a-a7bcd9d652a8\",\"displayName\":\"App\\\\Events\\\\ReclamoStatusChanged\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":15:{s:5:\\\"event\\\";O:31:\\\"App\\\\Events\\\\ReclamoStatusChanged\\\":3:{s:7:\\\"reclamo\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:18:\\\"App\\\\Models\\\\Reclamo\\\";s:2:\\\"id\\\";i:35;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:3:\\\"old\\\";s:6:\\\"creado\\\";s:3:\\\"new\\\";s:10:\\\"en_proceso\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\"},\"createdAt\":1759433707,\"delay\":null}',0,NULL,1759433707,1759433707);
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES
(1,'0001_01_01_000000_create_users_table',1),
(2,'0001_01_01_000001_create_cache_table',1),
(3,'0001_01_01_000002_create_jobs_table',1),
(4,'2025_09_10_000001_create_unidades_table',1),
(5,'2025_09_11_014704_create_personal_access_tokens_table',1),
(6,'2025_09_11_015807_create_permission_tables',1),
(7,'2025_09_11_022653_create_sucursals_table',1),
(8,'2025_09_11_033929_create_fyle_types_table',1),
(9,'2025_09_11_034427_create_clientes_table',1),
(10,'2025_09_11_040000_add_cliente_id_to_sucursals_table',1),
(11,'2025_09_11_050000_create_estados_table',1),
(12,'2025_09_11_050100_create_personas_table',1),
(13,'2025_09_11_050200_create_duenos_table',1),
(14,'2025_09_11_050300_create_transporte_temporals_table',1),
(15,'2025_09_11_060000_add_soft_deletes_to_domain_tables',1),
(16,'2025_09_11_070000_create_archivos_table',1),
(17,'2025_09_11_080500_add_fecha_vencimiento_to_archivos_table',1),
(18,'2025_09_11_170000_add_download_url_to_archivos_table',1),
(19,'2025_09_11_180000_add_agente_id_to_personas_table',1),
(20,'2025_09_12_000001_add_nombreapellido_to_duenos_table',1),
(21,'2025_09_20_041605_create_reclamo_types_table',2),
(22,'2025_09_20_041636_create_reclamos_table',2),
(23,'2025_09_20_041717_create_reclamo_archivo_table',2),
(24,'2025_09_21_045404_create_reclamo_comments_table',3),
(25,'2025_09_21_052554_add_creator_id_to_reclamo_comments_table',3),
(26,'2025_09_21_053558_add_creator_id_to_reclamos_table',3),
(27,'2025_09_21_090001_alter_sender_type_add_creador_to_reclamo_comments_table',4),
(28,'2025_09_21_091000_alter_reclamos_status_enum',4),
(29,'2025_09_21_091100_create_reclamo_logs_table',4),
(30,'2025_09_12_000500_add_fecha_alta_to_personas_table',5),
(31,'2025_09_23_145544_add_patente_to_personas_table',6),
(32,'2025_10_03_173635_add_fecha_alta_to_reclamos_table',7),
(33,'2025_10_03_183931_create_notifications_table',7),
(34,'2025_10_10_000101_update_reclamo_status_enum',8),
(35,'2025_10_10_010000_add_pagado_to_reclamos_table',8);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_permissions`
--

DROP TABLE IF EXISTS `model_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_permissions`
--

LOCK TABLES `model_has_permissions` WRITE;
/*!40000 ALTER TABLE `model_has_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_roles`
--

DROP TABLE IF EXISTS `model_has_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_roles`
--

LOCK TABLES `model_has_roles` WRITE;
/*!40000 ALTER TABLE `model_has_roles` DISABLE KEYS */;
INSERT INTO `model_has_roles` VALUES
(1,'App\\Models\\User',1),
(1,'App\\Models\\User',6),
(2,'App\\Models\\User',1),
(2,'App\\Models\\User',6),
(3,'App\\Models\\User',4),
(3,'App\\Models\\User',5),
(3,'App\\Models\\User',15),
(3,'App\\Models\\User',22),
(4,'App\\Models\\User',12),
(5,'App\\Models\\User',2),
(5,'App\\Models\\User',3),
(5,'App\\Models\\User',7),
(5,'App\\Models\\User',8),
(5,'App\\Models\\User',9),
(5,'App\\Models\\User',11),
(5,'App\\Models\\User',20),
(6,'App\\Models\\User',18),
(6,'App\\Models\\User',19),
(6,'App\\Models\\User',23);
/*!40000 ALTER TABLE `model_has_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `entity_type` varchar(255) DEFAULT NULL,
  `entity_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_foreign` (`user_id`),
  KEY `notifications_entity_type_entity_id_index` (`entity_type`,`entity_id`),
  KEY `notifications_created_at_index` (`created_at`),
  KEY `notifications_entity_type_index` (`entity_type`),
  KEY `notifications_entity_id_index` (`entity_id`),
  KEY `notifications_read_at_index` (`read_at`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES
(1,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 03:38:45','2025-10-04 03:38:45'),
(4,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 03:40:58','2025-10-04 03:40:58'),
(9,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 10:55:28','2025-10-04 10:55:28'),
(10,23,'reclamo',46,'creado','Nuevo reclamo #46 creado',NULL,'2025-10-04 10:55:32','2025-10-04 10:55:32'),
(11,23,'reclamo',46,'adjunto','Se adjuntó 1 archivo al reclamo #46',NULL,'2025-10-04 10:55:33','2025-10-04 10:55:33'),
(12,23,'reclamo',46,'estado','Estado cambiado de en proceso a solucionado',NULL,'2025-10-04 11:09:50','2025-10-04 11:09:50'),
(13,23,'reclamo',46,'comentario','Nuevo comentario en el reclamo #46',NULL,'2025-10-04 11:10:06','2025-10-04 11:10:06'),
(14,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 11:11:33','2025-10-04 11:11:33'),
(15,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 11:12:11','2025-10-04 11:12:11'),
(16,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 11:12:53','2025-10-04 11:12:53'),
(17,23,'reclamo',46,'adjunto','Se adjuntó 1 archivo al reclamo #46',NULL,'2025-10-04 11:12:55','2025-10-04 11:12:55'),
(18,23,'persona',150,'adjunto','Se adjuntó un archivo a la persona #150',NULL,'2025-10-04 11:14:39','2025-10-04 11:14:39'),
(19,23,'reclamo',46,'adjunto','Se adjuntó 1 archivo al reclamo #46',NULL,'2025-10-04 11:14:41','2025-10-04 11:14:41'),
(37,22,'reclamo',52,'creado','Nuevo reclamo #52 creado',NULL,'2025-10-06 13:22:25','2025-10-06 13:22:25'),
(60,7,'persona',153,'adjunto','Se adjuntó un archivo a la persona #153',NULL,'2025-10-13 18:00:09','2025-10-13 18:00:09'),
(64,8,'persona',50,'adjunto','Se adjuntó un archivo a la persona #50',NULL,'2025-10-13 19:05:28','2025-10-13 19:05:28'),
(67,12,'reclamo',56,'comentario','Nuevo comentario en el reclamo #56',NULL,'2025-10-13 19:32:21','2025-10-13 19:32:21'),
(68,18,'reclamo',58,'creado','Nuevo reclamo #58 creado','2025-10-14 13:19:37','2025-10-13 21:19:51','2025-10-14 13:19:37'),
(69,4,'persona',61,'adjunto','Se adjuntó un archivo a la persona #61',NULL,'2025-10-14 13:19:02','2025-10-14 13:19:02'),
(70,4,'persona',61,'adjunto','Se adjuntó un archivo a la persona #61',NULL,'2025-10-14 13:19:03','2025-10-14 13:19:03'),
(71,2,'reclamo',59,'creado','Nuevo reclamo #59 creado','2025-10-14 17:50:13','2025-10-14 13:19:09','2025-10-14 17:50:13'),
(72,2,'reclamo',59,'adjunto','Se adjuntaron 2 archivos al reclamo #59','2025-10-14 17:50:01','2025-10-14 13:19:11','2025-10-14 17:50:01'),
(73,18,'reclamo',59,'asignacion','El reclamo fue reasignado a un nuevo agente',NULL,'2025-10-14 17:49:42','2025-10-14 17:49:42'),
(74,18,'reclamo',37,'estado','Estado cambiado de creado a en proceso',NULL,'2025-10-14 18:17:01','2025-10-14 18:17:01'),
(75,18,'reclamo',37,'asignacion','El reclamo fue reasignado a un nuevo agente',NULL,'2025-10-14 18:17:01','2025-10-14 18:17:01'),
(76,12,'reclamo',40,'comentario','Nuevo comentario en el reclamo #40',NULL,'2025-10-14 18:17:58','2025-10-14 18:17:58'),
(77,12,'reclamo',40,'estado','Estado cambiado de creado a rechazado',NULL,'2025-10-14 18:18:05','2025-10-14 18:18:05'),
(78,12,'reclamo',39,'comentario','Nuevo comentario en el reclamo #39',NULL,'2025-10-14 18:25:25','2025-10-14 18:25:25'),
(79,12,'reclamo',39,'estado','Estado cambiado de creado a en proceso',NULL,'2025-10-14 18:25:55','2025-10-14 18:25:55'),
(80,11,'reclamo',39,'asignacion','El reclamo fue reasignado a un nuevo agente',NULL,'2025-10-14 18:25:57','2025-10-14 18:25:57'),
(81,12,'reclamo',39,'asignacion','El reclamo fue reasignado a un nuevo agente',NULL,'2025-10-14 18:25:57','2025-10-14 18:25:57'),
(82,18,'reclamo',38,'comentario','Nuevo comentario en el reclamo #38',NULL,'2025-10-14 19:03:28','2025-10-14 19:03:28'),
(83,18,'reclamo',38,'asignacion','El reclamo fue reasignado a un nuevo agente',NULL,'2025-10-14 19:03:38','2025-10-14 19:03:38'),
(85,8,'persona',187,'adjunto','Se adjuntó un archivo a la persona #187',NULL,'2025-10-15 12:04:42','2025-10-15 12:04:42'),
(86,2,'reclamo',60,'creado','Nuevo reclamo #60 creado',NULL,'2025-10-15 12:04:49','2025-10-15 12:04:49'),
(87,2,'reclamo',60,'adjunto','Se adjuntó 1 archivo al reclamo #60',NULL,'2025-10-15 12:04:50','2025-10-15 12:04:50'),
(88,22,'reclamo',69,'creado','Nuevo reclamo #69 creado',NULL,'2025-10-15 12:56:41','2025-10-15 12:56:41'),
(89,22,'reclamo',76,'creado','Nuevo reclamo #76 creado',NULL,'2025-10-15 13:18:21','2025-10-15 13:18:21'),
(90,22,'reclamo',77,'creado','Nuevo reclamo #77 creado',NULL,'2025-10-15 13:33:21','2025-10-15 13:33:21'),
(91,22,'reclamo',78,'creado','Nuevo reclamo #78 creado',NULL,'2025-10-16 02:51:52','2025-10-16 02:51:52'),
(92,18,'reclamo',79,'creado','Nuevo reclamo #79 creado',NULL,'2025-10-16 04:49:19','2025-10-16 04:49:19'),
(93,12,'reclamo',80,'creado','Nuevo reclamo #80 creado',NULL,'2025-10-16 05:32:13','2025-10-16 05:32:13');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=158 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES
(1,'App\\Models\\User',1,'api-token','3b03bd643d9e7bf1468ceba616e513c1d38cd85469a7598473299162856118ee','[\"*\"]',NULL,NULL,'2025-09-15 08:54:15','2025-09-15 08:54:15'),
(2,'App\\Models\\User',1,'api-token','835166d79b07c2490e42863e98e3449d2942f22885160d2291b41b8ad361c4a9','[\"*\"]','2025-09-15 18:04:05',NULL,'2025-09-15 13:22:52','2025-09-15 18:04:05'),
(3,'App\\Models\\User',1,'api-token','c36c9b94b86a48364c372e41997cb8920b2b358642778f21cea60b0a8421e2f6','[\"*\"]','2025-09-15 14:45:23',NULL,'2025-09-15 13:59:24','2025-09-15 14:45:23'),
(4,'App\\Models\\User',1,'api-token','0985cf03bca88d6342e3df0c4d2c66a76bee682235c258288bddfb6efcfa22fe','[\"*\"]','2025-09-18 14:57:54',NULL,'2025-09-15 14:45:44','2025-09-18 14:57:54'),
(5,'App\\Models\\User',2,'api-token','a4ec4eda8a663e8c7b2d31f56aa027191c3c17d6bba9dd30f1d52829af3d6900','[\"*\"]',NULL,NULL,'2025-09-15 14:57:30','2025-09-15 14:57:30'),
(6,'App\\Models\\User',3,'api-token','97054d7f72819b5ea6a5895812d206731ea41cc949bb1ea8df3ec38a9fb32fd0','[\"*\"]',NULL,NULL,'2025-09-15 14:58:24','2025-09-15 14:58:24'),
(7,'App\\Models\\User',1,'api-token','10dcd7f8c3a50253343925b0982f244b8fee2960adfd54d6c2bfab0a9c2e4d36','[\"*\"]','2025-09-15 15:42:05',NULL,'2025-09-15 15:42:04','2025-09-15 15:42:05'),
(8,'App\\Models\\User',1,'api-token','0a3fcb3d1c9d6d31651e875a66636c7b777ed55698a106fc80ccf09498df9b48','[\"*\"]','2025-09-15 15:49:48',NULL,'2025-09-15 15:42:05','2025-09-15 15:49:48'),
(9,'App\\Models\\User',4,'api-token','ab57741f810ea6c2ddc4308a4c255748c92c65bbabf353681e60eace5c2e79f0','[\"*\"]',NULL,NULL,'2025-09-15 15:49:36','2025-09-15 15:49:36'),
(10,'App\\Models\\User',4,'api-token','744d062527ecd4264aa8ef516bf2e435fe565ee9d5f6558600ab810e48abb370','[\"*\"]','2025-09-18 22:14:01',NULL,'2025-09-15 15:50:38','2025-09-18 22:14:01'),
(11,'App\\Models\\User',1,'api-token','2e7d62da7f0066d25cc58687f83ffbff8bc2157f952944fe0b373d2cfd06708e','[\"*\"]','2025-09-16 16:49:55',NULL,'2025-09-15 18:11:42','2025-09-16 16:49:55'),
(12,'App\\Models\\User',5,'api-token','1653076b6ef44921cf0a8b98469602e850758ba03f2fca9b594dc22aeead3a02','[\"*\"]',NULL,NULL,'2025-09-16 15:26:28','2025-09-16 15:26:28'),
(15,'App\\Models\\User',1,'api-token','13a34d0eaec1d88274c7074a761999a6777e82c8e98492a2c708d53e518457e4','[\"*\"]','2025-09-23 16:56:39',NULL,'2025-09-16 16:55:24','2025-09-23 16:56:39'),
(16,'App\\Models\\User',7,'api-token','c69e3cbebed3e403d86f91c239b9743066835d50c4df7659b91f954e0c905675','[\"*\"]',NULL,NULL,'2025-09-17 12:39:55','2025-09-17 12:39:55'),
(17,'App\\Models\\User',8,'api-token','a170a00f7b59c37c504db81557af8b1bacf13017c6d8a5a5fc20695abcdcc76a','[\"*\"]',NULL,NULL,'2025-09-17 12:41:17','2025-09-17 12:41:17'),
(19,'App\\Models\\User',4,'api-token','89b43a7577e0ff27d1679ff1a08256ea9a7ffb6a37248329f4cc1617208f28a3','[\"*\"]','2025-09-23 20:00:00',NULL,'2025-09-17 17:48:54','2025-09-23 20:00:00'),
(20,'App\\Models\\User',9,'api-token','3f16d1148e42844b650dc8f699670e57fec6b369ce3fa32cc0ffe79950ed20fa','[\"*\"]',NULL,NULL,'2025-09-19 14:56:44','2025-09-19 14:56:44'),
(23,'App\\Models\\User',10,'api-token','5b44bbba566121a261a8503f17127c35098defa15dbb7ec6dd4908fa6eb4514a','[\"*\"]',NULL,NULL,'2025-09-21 22:42:12','2025-09-21 22:42:12'),
(24,'App\\Models\\User',10,'api-token','bb398beb101b307602c3986797586b9c292d1409eceaf720f56c1a52c6aa08b2','[\"*\"]','2025-09-22 03:48:54',NULL,'2025-09-21 22:47:25','2025-09-22 03:48:54'),
(29,'App\\Models\\User',11,'api-token','010a905b68367d28fc611d1ce1fcf8ef22469ab0a5d1e0f754053a4615893387','[\"*\"]',NULL,NULL,'2025-09-22 12:35:19','2025-09-22 12:35:19'),
(33,'App\\Models\\User',5,'api-token','c16b07c275382157bf8f6165e320a5cfed0f65f171aee0eeb392992a17b54112','[\"*\"]','2025-09-22 18:04:50',NULL,'2025-09-22 17:27:16','2025-09-22 18:04:50'),
(34,'App\\Models\\User',12,'api-token','c87a1a18867a78db2d30ca6694b3997f2d118bd3e0616062f8624ac010cc36a3','[\"*\"]',NULL,NULL,'2025-09-22 19:59:18','2025-09-22 19:59:18'),
(35,'App\\Models\\User',13,'api-token','53c27e83e7c5f07ed4c461fa370b14f409f671170a851f1e65f07d9879701201','[\"*\"]',NULL,NULL,'2025-09-23 14:47:00','2025-09-23 14:47:00'),
(36,'App\\Models\\User',14,'api-token','05f953f2eb328a56e6de8e1748b6647db1319ddfadf5432282541da1ffc7ea19','[\"*\"]',NULL,NULL,'2025-09-23 14:48:27','2025-09-23 14:48:27'),
(37,'App\\Models\\User',13,'api-token','8718c683ece57adec0dcce660d9849eacb957954c0e4813b51ec28c18b991675','[\"*\"]','2025-09-23 15:07:54',NULL,'2025-09-23 14:58:04','2025-09-23 15:07:54'),
(38,'App\\Models\\User',15,'api-token','4e05cbe30c779fa25375ec60e247a7fd71437a47e6a77843cac81e0e885f07da','[\"*\"]',NULL,NULL,'2025-09-23 15:06:58','2025-09-23 15:06:58'),
(39,'App\\Models\\User',15,'api-token','0c9c28a4d42ec2da56a005457d09e8b998a073eaf9559a80a9473068d4a5edc4','[\"*\"]','2025-10-01 17:20:13',NULL,'2025-09-23 15:08:06','2025-10-01 17:20:13'),
(40,'App\\Models\\User',1,'api-token','209e27fd2cd0d5fdfd9ff8d8f313eaa99dd68fb7b3a6cd8ca9b583f133c91c57','[\"*\"]','2025-09-23 16:56:41',NULL,'2025-09-23 16:56:39','2025-09-23 16:56:41'),
(41,'App\\Models\\User',1,'api-token','cbc07a3c44ba8851a4996463a41a15e77233e8e5ed38e21734f0cc40c10a42bc','[\"*\"]','2025-09-23 16:56:47',NULL,'2025-09-23 16:56:46','2025-09-23 16:56:47'),
(42,'App\\Models\\User',1,'api-token','d157e35ba11bd9f4bc72d4d1e9a5ccebd8e1564bef9145255119ec7d9a548850','[\"*\"]','2025-09-30 11:32:13',NULL,'2025-09-23 18:24:48','2025-09-30 11:32:13'),
(44,'App\\Models\\User',16,'api-token','9666e72afedf533fb488a436727435174a80bb0d8505ff3d9be37e40868a86b6','[\"*\"]',NULL,NULL,'2025-09-24 14:42:07','2025-09-24 14:42:07'),
(45,'App\\Models\\User',17,'api-token','69502c370013cfb85b5308d4aabff096bcab120727fc9772237dcfb820f7deeb','[\"*\"]',NULL,NULL,'2025-09-24 14:47:42','2025-09-24 14:47:42'),
(48,'App\\Models\\User',4,'api-token','3a56e830f867f5ea6aab8f617e1c1a9426fddd43ee412e76e656439be2f5ef0b','[\"*\"]','2025-09-25 19:49:05',NULL,'2025-09-25 15:59:48','2025-09-25 19:49:05'),
(49,'App\\Models\\User',19,'api-token','611610f971567cfe365d4bcd7121b5e05dc11774ab67c52ecb842106fa40a532','[\"*\"]',NULL,NULL,'2025-09-25 17:56:31','2025-09-25 17:56:31'),
(50,'App\\Models\\User',20,'api-token','d11bfed86935fe9a13768794a339efa402be58a109f41f31538c6fa14692bce1','[\"*\"]',NULL,NULL,'2025-09-25 18:13:06','2025-09-25 18:13:06'),
(52,'App\\Models\\User',16,'api-token','809771bbb2361ac871450e50b01dfcafebbcc56fdcb7a3b1971a4011349e9cf3','[\"*\"]','2025-09-26 20:15:35',NULL,'2025-09-26 16:38:59','2025-09-26 20:15:35'),
(55,'App\\Models\\User',16,'api-token','a9c2c6736b330c0dd875d10001625932dcea77e497d8744e4825af64544fdcc6','[\"*\"]','2025-09-27 14:24:48',NULL,'2025-09-27 10:58:53','2025-09-27 14:24:48'),
(69,'App\\Models\\User',21,'api-token','31246fa6ad5d20e04cf2831a320715ba712522a12fb1a74114a4c9ade4958746','[\"*\"]',NULL,NULL,'2025-09-29 02:24:57','2025-09-29 02:24:57'),
(70,'App\\Models\\User',21,'api-token','e74059b750c923e9797d9d9a9c81f8eb478a35d301f54f363f2e40515a0f139b','[\"*\"]','2025-09-29 02:28:47',NULL,'2025-09-29 02:25:13','2025-09-29 02:28:47'),
(72,'App\\Models\\User',1,'api-token','323f1cf56d01ac83874ca5a6899a517d64b62677e60f93c66d003cb9f992bba6','[\"*\"]','2025-10-02 14:17:48',NULL,'2025-09-30 11:32:38','2025-10-02 14:17:48'),
(73,'App\\Models\\User',2,'api-token','61e39e24b1f536b971cbbaf2a16bf7dd548c71ed70c4b5e22db21c9197224eda','[\"*\"]','2025-10-06 13:42:09',NULL,'2025-09-30 11:34:57','2025-10-06 13:42:09'),
(74,'App\\Models\\User',4,'api-token','74f91154b4caad4265f870b3bea3092f062321bc641dd7318017759237676ca6','[\"*\"]','2025-10-03 13:43:54',NULL,'2025-09-30 17:26:37','2025-10-03 13:43:54'),
(76,'App\\Models\\User',12,'api-token','a6b0fff8c40792947dba62eb1fe7ceeb5bf5b08ae31bfb08d745c8704be0149c','[\"*\"]','2025-10-02 20:04:09',NULL,'2025-09-30 18:05:04','2025-10-02 20:04:09'),
(77,'App\\Models\\User',1,'api-token','d72d8ce1afabd319dd0d95feca27b44384ab214fe5ed34f2632bf1811322d588','[\"*\"]','2025-10-01 11:29:14',NULL,'2025-09-30 19:32:02','2025-10-01 11:29:14'),
(78,'App\\Models\\User',5,'api-token','d625e4b5ded5955228cdca55f4bdfc8683461d75bcd019f012b7ce281faca5f8','[\"*\"]','2025-10-09 20:16:44',NULL,'2025-10-01 13:38:27','2025-10-09 20:16:44'),
(79,'App\\Models\\User',2,'api-token','6e591aebcfbb6bb172e020a0d9fc9fe37880df0f6cb86ef7cf56cd34c6871489','[\"*\"]','2025-10-06 13:59:22',NULL,'2025-10-01 17:06:04','2025-10-06 13:59:22'),
(80,'App\\Models\\User',15,'api-token','47d9dfae5c639715c023313f925715c9898e36a0682a0c2457caaca28360dac4','[\"*\"]','2025-10-06 14:07:07',NULL,'2025-10-01 17:20:14','2025-10-06 14:07:07'),
(81,'App\\Models\\User',22,'api-token','9ea0ef6844cb698d989e948396035921cf51378092549c8ac9c82dcfa760a2f7','[\"*\"]',NULL,NULL,'2025-10-01 18:48:30','2025-10-01 18:48:30'),
(82,'App\\Models\\User',2,'api-token','6fbedac5401b2213691a7162c28539b83ee62125712a0c37b0fa52765b781652','[\"*\"]','2025-10-02 14:18:09',NULL,'2025-10-02 14:18:07','2025-10-02 14:18:09'),
(83,'App\\Models\\User',2,'api-token','009b1aeecba5225a7724c9645ea6a47c84afa2e1e5f61e548ae6aa8d090841ce','[\"*\"]','2025-10-02 17:04:18',NULL,'2025-10-02 14:19:06','2025-10-02 17:04:18'),
(84,'App\\Models\\User',22,'api-token','36cea148a31ef1ffb6940c802d1649efcbecab5206a152589f171e907bfdb28a','[\"*\"]','2025-10-02 17:04:27',NULL,'2025-10-02 17:04:26','2025-10-02 17:04:27'),
(85,'App\\Models\\User',22,'api-token','76ca1ad7a0a9be03139e8cba1182112a45d7dc3a3d9d835b1911f6a8a20f4eac','[\"*\"]','2025-10-02 18:26:18',NULL,'2025-10-02 17:04:30','2025-10-02 18:26:18'),
(87,'App\\Models\\User',2,'api-token','e15dfc33494080a4b1fc73a1f189a57149dddf3ad4ad0a46f02a46ca82d2818d','[\"*\"]','2025-10-03 12:03:21',NULL,'2025-10-03 11:59:58','2025-10-03 12:03:21'),
(88,'App\\Models\\User',2,'api-token','d838003e4ca3614b306afb89c064d0730b852f726a47121141e2e404c2ff2837','[\"*\"]','2025-10-03 12:03:55',NULL,'2025-10-03 12:03:36','2025-10-03 12:03:55'),
(93,'App\\Models\\User',23,'api-token','b509273ec0b5b90ef07dbfe923452855341ae2d19e88c47c157279acb6091e76','[\"*\"]',NULL,NULL,'2025-10-04 02:55:13','2025-10-04 02:55:13'),
(95,'App\\Models\\User',21,'api-token','09492bee22ef3eb2d853b3a431a477b5eabc4d85a550117ea68ff57e69441fbc','[\"*\"]','2025-10-04 10:47:41',NULL,'2025-10-04 10:47:34','2025-10-04 10:47:41'),
(96,'App\\Models\\User',23,'api-token','b9d33c2b1bbd3e6d187e1da4339bc5125106ff54090b39434ce2610add5a63c7','[\"*\"]','2025-10-04 10:48:13',NULL,'2025-10-04 10:48:08','2025-10-04 10:48:13'),
(97,'App\\Models\\User',23,'api-token','9be85e97330eff65ae69cae2ba32d83266bcaaa357bddc2f78e47672293ddb5a','[\"*\"]','2025-10-04 10:49:12',NULL,'2025-10-04 10:48:54','2025-10-04 10:49:12'),
(99,'App\\Models\\User',23,'api-token','0a7c1b988a943ebee71c09003aa14fa6aab5f7ea1d5572780a71d9f75c445141','[\"*\"]','2025-10-04 10:54:06',NULL,'2025-10-04 10:52:58','2025-10-04 10:54:06'),
(101,'App\\Models\\User',23,'api-token','bde319ec63f9c562119fa7fa4d4cb3f84ee3263b91bfd9392107fb59ea31773c','[\"*\"]','2025-10-04 10:58:46',NULL,'2025-10-04 10:56:47','2025-10-04 10:58:46'),
(112,'App\\Models\\User',2,'api-token','98fe87e650d7f4ffccbcff83174f86e790d0196cbcc3f215b3929a60ea285125','[\"*\"]','2025-10-09 16:42:32',NULL,'2025-10-09 16:42:10','2025-10-09 16:42:32'),
(113,'App\\Models\\User',2,'api-token','cce60298f3117f847264b3b609967e8f3bc213d2d12ecf5fa2969a34213d38a0','[\"*\"]','2025-10-09 17:07:38',NULL,'2025-10-09 16:44:24','2025-10-09 17:07:38'),
(116,'App\\Models\\User',2,'api-token','96fb24914860785f30aaf1800c252fc7fd40af57e1a70413c0d2191f28991ab0','[\"*\"]','2025-10-09 17:09:09',NULL,'2025-10-09 17:09:09','2025-10-09 17:09:09'),
(119,'App\\Models\\User',5,'api-token','695bbd4768a1e024fa503a9a22b858b94bae8c64fec14558d22766790af23e33','[\"*\"]','2025-10-10 23:49:19',NULL,'2025-10-09 20:16:45','2025-10-10 23:49:19'),
(127,'App\\Models\\User',2,'api-token','2a6e242302e9283a83afe6cb446660c2c19b36d9f80172e71d425c7631b2be82','[\"*\"]','2025-10-13 17:55:08',NULL,'2025-10-13 12:42:06','2025-10-13 17:55:08'),
(129,'App\\Models\\User',2,'api-token','41632f01ff26af2c09cbc8a459a7a50a3af3069cc6b02a66b09275dc8ba7ba57','[\"*\"]','2025-10-15 17:55:11',NULL,'2025-10-13 12:50:41','2025-10-15 17:55:11'),
(131,'App\\Models\\User',4,'api-token','a81970205ef7a020b1484886f9d4d9a77cdad41d2c12079ab34f8b0303cf5aff','[\"*\"]','2025-10-14 11:46:01',NULL,'2025-10-13 13:06:26','2025-10-14 11:46:01'),
(132,'App\\Models\\User',15,'api-token','40994759becb5d7a54c30fbc0bfd31613f9a3a5f8fe78ce9b2c9b0c296a3f931','[\"*\"]','2025-10-13 13:58:09',NULL,'2025-10-13 13:10:08','2025-10-13 13:58:09'),
(135,'App\\Models\\User',12,'api-token','e82dc2a35be38bca488ecbf2f1147121bc87de563f65f223def0be3ffb455b72','[\"*\"]','2025-10-13 17:57:25',NULL,'2025-10-13 17:55:19','2025-10-13 17:57:25'),
(136,'App\\Models\\User',2,'api-token','74a647497bc264060d25d2581784e251800c6fe00c3e6184c9c85878dbc2db0f','[\"*\"]','2025-10-15 15:36:55',NULL,'2025-10-13 17:57:55','2025-10-15 15:36:55'),
(137,'App\\Models\\User',12,'api-token','fb0cb6d7779defd51277cbfde59e18e242a0fa3f7ea3835717f382ce2f057738','[\"*\"]','2025-10-13 18:14:21',NULL,'2025-10-13 17:58:11','2025-10-13 18:14:21'),
(139,'App\\Models\\User',12,'api-token','9be9e90844f4deb920d668654114a3796bf56eb79779f67fafb019c01bed85e6','[\"*\"]','2025-10-15 20:06:51',NULL,'2025-10-13 18:49:54','2025-10-15 20:06:51'),
(149,'App\\Models\\User',6,'api-token','14728e467ffccb991945e187e60eeaea92767c7795751c15604e9ad618d3e7e4','[\"*\"]',NULL,NULL,'2025-10-15 13:52:52','2025-10-15 13:52:52'),
(150,'App\\Models\\User',18,'api-token','9335ee82a997c3c462d36fb538e9a8dc852040a6a6582cd11dd473c1aaf4d3be','[\"*\"]',NULL,NULL,'2025-10-15 13:53:36','2025-10-15 13:53:36'),
(151,'App\\Models\\User',6,'api-token','a88a88e1420671986285dba4ca3d096f65e2d68441e365730012a1c30a360579','[\"*\"]','2025-10-16 05:32:45',NULL,'2025-10-16 02:28:02','2025-10-16 05:32:45'),
(152,'App\\Models\\User',6,'api-token','20f0681537b7c73281ad2b52172cd4f25bc22c4ea9a8d38af1a4a36ac8df61db','[\"*\"]','2025-10-16 04:40:57',NULL,'2025-10-16 04:40:00','2025-10-16 04:40:57'),
(153,'App\\Models\\User',6,'api-token','96c5ab200c79798c35215b93699ea2f3cf6d6f6e0b5bd63d743fc0ccaf68881c','[\"*\"]','2025-10-16 04:42:47',NULL,'2025-10-16 04:42:43','2025-10-16 04:42:47'),
(154,'App\\Models\\User',6,'api-token','bd31dd2ab3717bca75a251b23db90203d18660c76b39a7f2a3c61c553fa6aa70','[\"*\"]','2025-10-16 04:44:46',NULL,'2025-10-16 04:43:37','2025-10-16 04:44:46'),
(155,'App\\Models\\User',4,'api-token','cd3750c1b15c53be236832c31e94de471eb4da938915de0421bd932abf02b2a7','[\"*\"]','2025-10-16 04:49:19',NULL,'2025-10-16 04:45:06','2025-10-16 04:49:19'),
(156,'App\\Models\\User',6,'api-token','0ec74126794ab8ac336b8e32e01c99cca59c00cd7d65c1fddf15bdf04ade50c9','[\"*\"]','2025-10-16 04:59:40',NULL,'2025-10-16 04:49:23','2025-10-16 04:59:40'),
(157,'App\\Models\\User',6,'api-token','936a6617f8c4b49b6342a068c4c2dee87e2a98595fe8724e4a4f3bbc0b94eed0','[\"*\"]','2025-10-16 14:38:16',NULL,'2025-10-16 14:38:16','2025-10-16 14:38:16');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personas`
--

DROP TABLE IF EXISTS `personas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `personas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `apellidos` varchar(255) DEFAULT NULL,
  `patente` varchar(100) DEFAULT NULL,
  `nombres` varchar(255) DEFAULT NULL,
  `cuil` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `pago` decimal(12,2) DEFAULT NULL,
  `cbu_alias` varchar(255) DEFAULT NULL,
  `combustible` tinyint(1) NOT NULL DEFAULT 0,
  `unidad_id` bigint(20) unsigned DEFAULT NULL,
  `cliente_id` bigint(20) unsigned DEFAULT NULL,
  `sucursal_id` bigint(20) unsigned DEFAULT NULL,
  `agente_id` bigint(20) unsigned DEFAULT NULL,
  `estado_id` bigint(20) unsigned DEFAULT NULL,
  `tipo` tinyint(3) unsigned DEFAULT NULL,
  `observaciontarifa` varchar(255) DEFAULT NULL,
  `tarifaespecial` tinyint(3) unsigned DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_alta` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `personas_unidad_id_foreign` (`unidad_id`),
  KEY `personas_cliente_id_foreign` (`cliente_id`),
  KEY `personas_sucursal_id_foreign` (`sucursal_id`),
  KEY `personas_estado_id_foreign` (`estado_id`),
  KEY `personas_agente_id_foreign` (`agente_id`),
  CONSTRAINT `personas_agente_id_foreign` FOREIGN KEY (`agente_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `personas_cliente_id_foreign` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `personas_estado_id_foreign` FOREIGN KEY (`estado_id`) REFERENCES `estados` (`id`) ON DELETE SET NULL,
  CONSTRAINT `personas_sucursal_id_foreign` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `personas_unidad_id_foreign` FOREIGN KEY (`unidad_id`) REFERENCES `unidades` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=188 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personas`
--

LOCK TABLES `personas` WRITE;
/*!40000 ALTER TABLE `personas` DISABLE KEYS */;
INSERT INTO `personas` VALUES
(1,'Barrios',NULL,'Josias Luis','23398633369','3794007273','luisbarrios@logisticaargentinasrl.com',70.00,'6+265149465165168161',1,1,1,2,3,1,1,'Ok',0,'Todo ok, usuario de prueba','2025-09-15','2025-09-15 15:43:47','2025-09-15 15:43:47',NULL),
(2,'Gimenez',NULL,'David','23546546546','6545465465','jhgjldhlkhkr@gmail.com',0.00,'56465465465',0,1,4,8,2,2,1,'$1312 x km',1,'bajaaja','2025-09-15','2025-09-15 18:30:08','2025-09-17 12:43:51','2025-09-17 12:43:51'),
(3,'Eleno',NULL,'Alejo','23404241443','2923451965','alejoeleno9@gmail.com',0.00,'0140410803680051521946',0,1,13,NULL,2,1,1,NULL,0,NULL,'2025-09-18','2025-09-18 14:21:21','2025-09-18 14:21:21',NULL),
(4,'Ceparo',NULL,'Carla Elisabet','27329376489','3415800717','cceparo@gmail.com',0.00,'0000076500000023061309',1,1,13,NULL,3,1,1,NULL,0,NULL,'2025-09-19','2025-09-19 14:52:12','2025-09-19 14:52:12',NULL),
(5,'Noemi Cruz',NULL,'Romina','27-32295265-7','3413895038','Romi65@live.com.ar',0.00,'19102748-55127402368799',0,1,13,NULL,9,1,1,NULL,0,NULL,'2025-09-19','2025-09-19 00:00:00','2025-09-22 13:09:42',NULL),
(6,'eum reiciendis Officiis neque sed c',NULL,'Omnis','Assumenda est aut qu','19979956649','mybyp@mailinator.com',100.00,'Et vitae ut quisquam',0,3,13,92,NULL,1,1,'Quibusdam consequatu',1,'Aut aliqua Ut optio','1976-05-20','1976-05-20 00:00:00','2025-09-22 03:33:55','2025-09-22 03:33:55'),
(7,'Del Buono','LBN118','Narella','27399776649','2281307448','nohandelbuono@gmail.com',0.00,'1',0,1,14,253,11,1,1,NULL,0,NULL,'2023-06-09','2023-06-09 00:00:00','2025-09-24 11:42:45',NULL),
(8,'Marcelo Montenegro','DTC856','Walter','23219028369','3513338433','waltermontenegro31@gmail.com',0.00,'1',0,2,14,247,7,1,1,NULL,0,NULL,'2025-01-10','2025-01-10 00:00:00','2025-09-24 11:43:15',NULL),
(9,'German Medina','AA393PO','Daniel','20221923716','3704794216','dangermed@hotmail.com',0.00,'1',1,1,14,249,11,1,1,NULL,0,NULL,'2023-05-19','2023-05-19 00:00:00','2025-09-24 11:51:33',NULL),
(10,'Orlando Monla Pasut','AF500OJ','Exequiel','23326523879','2615753770','exequielmonospasut@gmail.com',0.00,'1',0,1,14,245,11,1,1,NULL,0,NULL,'2022-07-01','2022-07-01 00:00:00','2025-09-24 11:52:11',NULL),
(11,'Paredes',NULL,'Pablo','20397329977','3816466790','paredespablo26@gmail.com',0.00,'1',1,1,14,252,8,1,1,NULL,0,NULL,'2025-07-16','2025-07-16 00:00:00','2025-09-23 15:00:51',NULL),
(12,'Alberto Lescano','NCM039','Daniel','23228819069','3764801395','lescanodaniel2020@gmail.com',0.00,'1',1,1,14,255,11,1,1,NULL,0,NULL,'2023-01-04','2023-01-04 00:00:00','2025-09-24 11:55:50',NULL),
(13,'Sainz','AB393MN','Javier Fernando','20319114816','3765041407','fastmotos2012@gmail.com',0.00,'1',1,1,14,255,7,1,1,NULL,0,NULL,'2024-02-15','2024-02-15 00:00:00','2025-09-24 11:58:09',NULL),
(14,'Ivan Ciz','1','Mauro','20419314979','3416537351','cizmauro3@gmail.com',0.00,'4530000800014949307360',0,2,13,NULL,3,1,1,NULL,0,NULL,'2024-12-04','2024-12-04 00:00:00','2025-09-23 16:28:07',NULL),
(15,'NO TOCAR NO SE TOCA',NULL,'PRUEBAS','Assumenda totam inci','14189221034','puqyw@mailinator.com',100.00,'Exercitation cupidat',0,3,14,262,1,1,1,'Aut est occaecat qui',0,'Quas ut modi porro m','1984-04-10','1984-04-10 00:00:00','2025-09-23 13:52:51','2025-09-23 13:52:51'),
(16,'Morales','A009PHB','Claudio','20424512592','3794771822','caiomonsee23@gmail.com',0.00,'1',1,4,13,NULL,8,1,1,NULL,0,NULL,'2025-08-01','2025-08-01 00:00:00','2025-09-24 11:50:39',NULL),
(17,'Sainz',NULL,'Kevin','20404121481','3765041407','1@gmail.com',0.00,'1',1,1,14,219,11,1,1,NULL,0,NULL,'2025-04-25','2025-04-25 00:00:00','2025-09-23 11:45:41','2025-09-23 11:45:41'),
(18,NULL,'JZL422','Kevin Sainz Sainz','20404121481','3765041407','fastmotos2012@gmail.com',0.00,'0',1,1,14,255,12,1,2,NULL,0,NULL,'2025-04-25','2025-04-25 00:00:00','2025-09-24 11:59:01',NULL),
(19,'Aguirre',NULL,'Daniel Guadalupe','20208227042','3425231273','daniel.g.aguirre934@gmail.com',0.00,'0000003100068994923709',1,1,13,NULL,11,1,1,NULL,0,NULL,'2023-04-21','2023-04-21 00:00:00','2025-09-23 13:50:57',NULL),
(20,NULL,NULL,'Albert Charmelo 2222','Magni perferendis en','11769876183','rahuxy@mailinator.com',100.00,'Aspernatur ut impedi',1,4,14,245,6,2,2,'Nihil quia et proide',1,NULL,'2020-01-04','2020-01-04 00:00:00','2025-09-23 14:38:01','2025-09-23 14:38:01'),
(21,'Ortiz zzzzzz',NULL,'Joseeeee','Est sit harum cum c','17335365344','zuwobum@mailinator.com',100.00,'Impedit est volupt',1,4,14,245,6,2,1,'Id dolorum ipsum vol',1,'Id obcaecati minus o','2024-08-12','2024-08-12 00:00:00','2025-09-23 14:40:00','2025-09-23 14:40:00'),
(22,NULL,NULL,'Elit debitis magnam','Amet cum ut ut qui','12847334034','dise@mailinator.com',1.00,'Anim voluptatibus in',1,4,14,245,6,2,2,'Quos est sed eum in',1,NULL,'1993-07-10','1993-07-10 00:00:00','2025-09-23 14:47:50','2025-09-23 14:47:50'),
(23,'Luis Giordano','GCX061','Gerardo','20299917828','3425107106','gerardoluisgiordano@gmail.com',0.00,'0110501830050172861551',0,2,13,NULL,7,1,1,NULL,0,NULL,'2024-11-28','2024-11-28 00:00:00','2025-10-02 14:23:33',NULL),
(24,'Gomez',NULL,'Matias German','20344534595','3434662949','Matias_G15@hotmail.com',0.00,'0070380030004018804231',0,1,13,NULL,9,1,1,NULL,0,NULL,'2025-07-23','2025-07-23 00:00:00','2025-09-23 15:17:53',NULL),
(25,'aliquam id labo Obcaecati repudianda','111111','Modi','Voluptatibus placeat','15023935342','wahoj@mailinator.com',11.11,'Et ipsam in aute con',0,4,14,245,NULL,2,1,'Assumenda quae conse',0,'Aliquid est nesciunt','2012-09-22','2012-09-22 00:00:00','2025-10-01 13:38:56','2025-10-01 13:38:56'),
(26,'Massimiani',NULL,'Nicolas Esteban','20334685358','3425571244','nicomassimiani.88@gmail.com',0.00,'2850304040094855507698',0,1,13,NULL,7,1,1,NULL,0,NULL,'2024-05-14','2024-05-14 00:00:00','2025-09-23 15:22:36',NULL),
(27,'Evangelina Massimiani','11111','Maria','27321853779','3425044696','mariamassimiani23@gmail.com',0.00,'2850857140095487371198',0,1,13,NULL,11,1,1,NULL,0,NULL,'2022-09-05','2022-09-05 00:00:00','2025-09-23 16:26:56',NULL),
(28,'Lopez',NULL,'Mariano Martin','20236221882','3425316886','sherlocklopez1973@gmail.com',0.00,'0140318103654453256687',0,1,13,NULL,11,1,1,NULL,0,NULL,'2023-01-04','2023-01-04 00:00:00','2025-09-23 15:42:15',NULL),
(29,NULL,NULL,'Raul Edgardo Salegas','11','3425900177','gerardoluisgiordano@gmail.com',0.00,'11',0,1,13,NULL,2,1,2,NULL,0,NULL,'2025-07-01','2025-07-01 00:00:00','2025-09-23 15:55:10',NULL),
(30,'Herzog',NULL,'Rogelio Jose Maria','20063067505','3424235265','herzogroger70@gmail.com',0.00,'0000229700000000156413',0,1,13,NULL,11,1,1,NULL,0,NULL,'2022-07-01','2022-07-01 00:00:00','2025-09-23 16:04:21',NULL),
(31,'Gabriel Paniagua','AF970RF','Leandro','20342391525','3624092272','Leopaniagua3@gmail.com',0.00,'4530000800018661160803',1,1,14,254,2,1,1,NULL,0,NULL,'2025-05-28','2025-05-28 00:00:00','2025-09-24 12:14:20',NULL),
(32,NULL,'IWK373','Talavera Fracisco','1','3794342560','martinezlopezmarialaura78@gmail.com',0.00,'1',1,3,14,254,11,1,2,NULL,0,NULL,'2023-08-04','2023-08-04 00:00:00','2025-09-24 12:13:53',NULL),
(33,'Trejo','AA046IX','Matias','20265946942','3624623475','matiastrejo1278@gmail.com',0.00,'0340208708208008158008',0,1,14,254,11,1,1,NULL,0,NULL,'2022-07-01','2022-07-01 00:00:00','2025-09-24 12:37:02',NULL),
(34,'Rolon','AC503EM','Eusebio','20210647121','3624096538','mauroaucar@gmail.com',0.00,'1',0,2,14,254,11,1,1,NULL,0,NULL,'2022-10-18','2022-10-18 00:00:00','2025-09-24 12:58:21',NULL),
(35,'Garcia Ocampo','CLS258','Guido','20420617926','3487641334','Benjamingarciaocampo@gmail.com',0.00,'4530000800014782670333',1,3,14,254,8,3,1,NULL,0,NULL,'2025-05-28','2025-05-28 00:00:00','2025-09-24 13:40:07',NULL),
(36,'Moran','AC382LS','Ezequiel Guillermo','20294021702','3585049862','moranezequiel065@gmail.com',0.00,'1910494255149400227249',0,1,14,260,7,1,1,NULL,0,NULL,'2024-10-29','2024-10-29 00:00:00','2025-09-24 13:48:45',NULL),
(37,'Moran','AC382LS','Ezequiel Guillermo','20294021702','3585049862','moranezequiel065@gmail.com',0.00,'1910494255149400227249',0,1,14,260,7,1,1,NULL,0,NULL,'2024-10-29','2024-10-29 00:00:00','2025-09-24 13:58:03',NULL),
(38,'Belotti','LQC085','Diego Pablo','20307667410','3584379767','diegopablobelotti@hotmail.com',0.00,'2850349140094970215588',0,1,14,260,11,1,1,NULL,0,NULL,'2023-04-20','2023-04-20 00:00:00','2025-09-24 14:00:15',NULL),
(39,'Rufino','AC737OU','Guillermo Daniel','20309901879','3584878318','guillermodrufino@gmail.com',0.00,'1430001713000685640018',0,1,14,260,11,1,1,NULL,0,NULL,'2023-03-28','2023-03-28 00:00:00','2025-09-24 14:03:33',NULL),
(40,'Guzman','LFD923','Allais Mayco','20381098878','3585044858','mayco.allais@gmail.com',0.00,'0720159888000002586836',0,1,14,260,11,1,1,NULL,0,NULL,'2024-07-20','2024-07-20 00:00:00','2025-09-24 14:05:59',NULL),
(41,'Benitez','KXR431','German Rodrigo','20301020652','3416908096','g3rmi@hotmail.com',0.00,'0150969801000009623784',0,3,14,257,11,1,1,NULL,0,NULL,'2024-04-25','2024-04-25 00:00:00','2025-09-24 14:27:11',NULL),
(42,'Palavecino','AD587GQ','Ricardo','20345948083','3416669558','contacto2rlogistica@gmail.com',0.00,'0720478888000040229818',0,1,14,257,7,1,1,NULL,0,NULL,'2025-04-01','2025-04-01 00:00:00','2025-09-24 14:43:03',NULL),
(43,NULL,'AC002PK','Hurt Leandro Ramon','20314868626','3416908096','g3rmi@hotmail.com',0.00,'1',0,3,14,257,12,1,2,NULL,0,NULL,'2025-03-14','2025-03-14 00:00:00','2025-09-24 14:49:46',NULL),
(44,'Turon','AA208RS','Mario','20145024766','3416675786','turonmario@gmail.com',0.00,'Efectivo',0,1,14,254,7,1,1,NULL,0,NULL,'2025-05-12','2025-05-12 00:00:00','2025-09-25 11:48:11',NULL),
(45,'Escudero','AB945EZ','Fernando','23204137579','2664846627','fernandoescud68@gmail.com',0.00,'2850409840095496306978',0,1,14,264,11,1,1,NULL,0,NULL,'2024-07-30','2024-07-30 00:00:00','2025-09-25 11:57:10',NULL),
(46,'Bosch,','AB745IN','Gustavo Andres','20210484443','3424211278','gustbosch@gmail.com',0.00,'0150544301000156536915',0,1,14,251,2,1,1,NULL,0,NULL,'2025-03-14','2025-03-14 00:00:00','2025-09-25 12:13:43',NULL),
(47,'Ahuad','AB655PA','Maria del Carmen','27176078567','2954681176','mariahuad@hotmail.com',0.00,'0930331520100000115789',1,1,14,265,11,1,1,NULL,0,NULL,'2022-08-18','2022-08-18 00:00:00','2025-09-25 12:20:50',NULL),
(48,'Nicolas Casorati','NGY233','Mario','20312439108','1','nicolas.casorati@gmail.com',0.00,'0070682330004004741483',0,1,14,266,11,1,1,NULL,0,NULL,'2024-07-30','2024-07-30 00:00:00','2025-10-01 12:03:15',NULL),
(49,'Pouza','KTG347','Luis','20209223504','1123766049','luispouza@gmail.com',0.00,'0140109303504462209243',0,1,14,266,5,1,1,NULL,0,NULL,'2025-07-25','2025-07-25 00:00:00','2025-09-25 15:07:16',NULL),
(50,'Caceres','OQS348','Ariel','20287472391','1124757890','1@gmail.com',0.00,'1',0,2,14,266,8,1,1,NULL,0,NULL,'2025-07-29','2025-07-29 00:00:00','2025-09-25 15:21:01',NULL),
(51,'Agustin Lopez','A189KPS','Juan','23339488479','3794148307','juanagustinlopez95@gmail.com',0.00,'1',1,4,14,256,8,1,1,NULL,0,NULL,'2025-08-14','2025-08-14 00:00:00','2025-09-25 17:06:26',NULL),
(52,'Argentino Aguilar','A207FMF','Luis','20452496391','3734519057','la009luis@gmail.com',0.00,'1',0,4,14,256,8,1,1,NULL,0,NULL,NULL,'2025-09-25 16:28:14','2025-09-25 17:16:35',NULL),
(53,'Gabriel Ponce','A180OUB','Carlos','20426030956','3794343539','gabrielex22@hotmail.com',0.00,'1',1,4,14,256,8,1,1,NULL,0,NULL,'2025-08-11','2025-08-11 00:00:00','2025-09-25 17:17:34',NULL),
(54,'Maria Ruefli','AB929ZU','Jose','23268097279','1166514500','joseruefli@gmail.com',0.00,'1',1,1,14,259,5,1,1,NULL,0,NULL,'2025-08-07','2025-08-07 00:00:00','2025-09-25 17:18:36',NULL),
(55,'Labeguere','OVH639','Adolfo Omar','20166813000','2914046803','aolabeguere@gmail.com',0.00,'0170285140000033414463',0,1,13,NULL,7,1,1,NULL,0,NULL,'2024-09-17','2024-09-17 00:00:00','2025-09-25 17:05:32',NULL),
(56,'Bordon','A199AVO','Gabriela','27369722617','3624888782','bordongabrielayanina@gmail.com',0.00,'1',1,4,14,254,8,1,1,NULL,0,NULL,'2025-08-06','2025-08-06 00:00:00','2025-09-25 17:42:03',NULL),
(57,'Robert','LAC039','Juan Francisco','20176734842','2914471938','juanf_robert@hotmail.com',0.00,'0170080040000041235988',1,2,13,NULL,9,3,1,NULL,0,NULL,'2025-07-02','2025-07-02 00:00:00','2025-09-25 17:10:46',NULL),
(58,'Gomez','AB966QD','Fabio','20176730820','2915067477','fabiogomezford@gmail.com',0.00,'0150539901000131358581',0,1,13,NULL,7,1,1,NULL,0,NULL,'2023-02-01','2023-02-01 00:00:00','2025-09-25 17:14:32',NULL),
(59,'Alioto','AC599BT','Laura Daniela','27247208130','2914680823','Tobiasralioto@gmail.com',0.00,'0140437503620650554156',1,2,13,NULL,3,1,1,NULL,0,NULL,'2025-04-24','2025-04-24 00:00:00','2025-09-25 17:18:35',NULL),
(60,'Galindo Gomez','MPS088','Mario Flavio','20333873851','2944366426','mfgalindopersonal@gmail.com',0.00,'0000003100086897090483',0,1,13,NULL,11,1,1,NULL,0,NULL,'2024-11-21','2024-11-21 00:00:00','2025-09-25 17:25:23',NULL),
(61,'Luis Figueroa','AG064VO','Claudio','20170049625','3543537468','gallodragon@yahoo.com.ar',0.00,'2850313240095515927218',1,1,13,NULL,4,1,1,NULL,0,NULL,'2025-02-13','2025-02-13 00:00:00','2025-10-02 11:51:09',NULL),
(62,'Galleguido','AA940NK','Maximiliano','20373161358','3515172911','maxi010393@gmail.com',0.00,'0070196530004033172494',1,1,13,NULL,9,1,1,NULL,0,NULL,'2025-07-08','2025-07-08 00:00:00','2025-09-25 17:39:50',NULL),
(63,'Fernando Castilla','GJW025','Guillermo','2020707587?','3515154527','fgcastilla4@gmail.com',0.00,'4530000800017881195949',1,1,13,NULL,3,1,1,NULL,0,NULL,'2025-06-17','2025-06-17 00:00:00','2025-09-25 18:25:11',NULL),
(64,NULL,'NIY497','Varisco Jorge Andres','3435180859','3624888782','1@gmail.com',0.00,'1',1,1,14,259,5,1,2,NULL,0,NULL,'2025-08-19','2025-08-19 00:00:00','2025-09-25 17:49:48',NULL),
(65,'Esteves','AH022UA','Ricardo','20275507351','3513998339','estevesricardo1979@gmail.com',0.00,'0000003100072294574099',0,1,13,NULL,11,1,1,NULL,0,NULL,'2025-06-19','2025-06-19 00:00:00','2025-09-25 17:59:34',NULL),
(66,'Garay','NEI545','Nelson Daniel','20243197539','3515187301','nelsongaray2431@gmail.com',0.00,'4530000800013340777996',1,1,13,NULL,5,1,1,NULL,0,NULL,'2025-03-21','2025-03-21 00:00:00','2025-09-25 18:04:41',NULL),
(67,'Rondina','LPD728','Maria Eugenia','27269274714','1141418311','mariaronsina@gmail.com',0.00,'0000229700000000171243',1,1,13,NULL,9,1,1,NULL,0,NULL,'2025-07-24','2025-07-24 00:00:00','2025-09-25 18:14:30',NULL),
(68,'Leonela Di Lorenzo','AB506NJ','Lucia','27362671561','3417230481','luli.1917@gmail.com',0.00,'1',0,1,14,257,20,2,1,NULL,0,'baja 22/09/2025 consiguio mejor trabajo','2025-08-29','2025-08-29 00:00:00','2025-09-25 18:17:39',NULL),
(69,'Vera','NUZ218','Maximiliano Joaquin','20388309335','3541202470','joaquin.mv95@hotmail.com',0.00,'0000003100040386047699',0,1,13,NULL,7,1,1,NULL,0,NULL,'2025-02-20','2025-02-20 00:00:00','2025-09-25 18:17:33',NULL),
(70,'Savino','KVG999','Carlos Gabriel','20162182561','3415008212','1@gmail.com',0.00,'1',0,1,14,257,7,1,1,NULL,0,NULL,'2025-08-27','2025-08-27 00:00:00','2025-09-25 18:30:51',NULL),
(71,'Lasala','AH449RP','Exequiel','1','3794577011','Exequiellasala3@gmail.com',0.00,'1',0,1,13,NULL,2,1,1,NULL,0,NULL,'2025-07-22','2025-07-22 00:00:00','2025-09-25 18:34:51',NULL),
(72,'Andres Dimartino','AB712DD','Francisco','20375346746','3704259005','panchodimar@hotmail.com',0.00,'3150120404000885960017',0,1,13,269,11,1,1,NULL,0,NULL,'2023-01-09','2023-01-09 00:00:00','2025-09-25 18:58:53',NULL),
(73,'Estevez','AA212RX','Horacio Gaston','20269919397','3704612058','estevezhoraciogaston67@gmail.com',0.00,'3150120402000589500014',1,1,13,269,11,1,1,NULL,0,NULL,'2024-05-09','2024-05-09 00:00:00','2025-09-25 19:09:49',NULL),
(74,'Gonzalez Alcides','AA772NN','Martin','20271120010','3704806035','martiingnz69@gmail.com',0.00,'0000003100030036746506',0,1,13,269,5,1,1,NULL,0,NULL,'2025-06-05','2025-06-05 00:00:00','2025-09-25 19:16:10',NULL),
(75,'Maciel','AC362ID','Diego','20271936630','3704555018','maurismv@hotmail.com',0.00,'0170262240000008235620',1,1,13,269,2,1,1,NULL,0,NULL,'2025-07-08','2025-07-08 00:00:00','2025-09-25 19:27:20',NULL),
(76,'Acciardi','FPG649','Bruno Nicolas','20455722749','1140493533','acciardiclaudio@gmail.com',0.00,'0070139230004072410694',0,1,13,92,2,3,1,NULL,0,NULL,'2025-03-20','2025-03-20 00:00:00','2025-09-25 19:35:51',NULL),
(77,NULL,'AA897KP','Soto, Orlando','20139732562','3462593620','translogisticrm@gmail.com',0.00,'1',0,2,3,271,19,1,2,NULL,0,NULL,'2025-05-06','2025-05-06 00:00:00','2025-09-30 11:55:53',NULL),
(78,'Res','DWF703','Juan Manuel','20360799175','1157641052','Resjuanmanuel91@gmail.com',0.00,'0070398530004016844039',0,2,3,271,19,3,1,NULL,0,NULL,'2025-05-26','2025-05-26 00:00:00','2025-09-30 12:00:59',NULL),
(79,'Ramos','LZR051','Damian','23223393039','1153328998','damiandiegoramos@gmail.com',0.00,'0170321240000076603684',0,2,3,271,19,1,1,NULL,0,NULL,'2025-04-14','2025-04-14 00:00:00','2025-09-30 12:05:08',NULL),
(80,'Mancharis','CFW485','Ivan','20333025214','1132170926','ivanmancharis@live.com.ar',0.00,'0070124830004168485117',0,2,3,271,19,1,1,NULL,0,NULL,NULL,'2025-09-30 12:20:28','2025-09-30 12:20:28',NULL),
(81,NULL,'AG021JC','Javier Buccellas','20258502672','1134004486','javierbuccella@gmail.com',0.00,'1',0,2,3,271,19,1,2,NULL,0,NULL,'2025-06-19','2025-06-19 00:00:00','2025-09-30 12:24:19',NULL),
(82,'Rueda','AH042RK','Guillermo','20285336989','3442679830','guillermojoserueda1981@gmail.com',0.00,'0110211830021119700901',0,1,3,273,11,1,1,NULL,0,NULL,'2025-03-20','2025-03-20 00:00:00','2025-09-30 12:32:24',NULL),
(83,'Lazza','KOP095','Nicolas Alfredo','20331303179','3442579010','Nicolaslazza3@gmail.com',0.00,'0170212740000033573739',0,1,3,273,3,1,1,NULL,0,NULL,'2025-02-11','2025-02-11 00:00:00','2025-09-30 12:35:21',NULL),
(84,'Bochio','EMV512','Laura Andrea','27236975415','3442538388','laurabochio9@gmail.com',0.00,'0000003100002980950234',0,1,3,273,9,1,1,NULL,0,NULL,'2025-02-27','2025-02-27 00:00:00','2025-09-30 12:41:50',NULL),
(85,NULL,'OTQ926','Gonzalez, Luis Maria','20173295937','3442544108','Gonzalez.lm65@gmail.com',0.00,'1',0,1,3,273,11,1,2,NULL,0,NULL,'2025-02-24','2025-02-24 00:00:00','2025-09-30 12:44:43',NULL),
(86,'Sanchez','LNO243','Josue Angel','20465869896','3512349058','Josueahre@gmail.com',0.00,'0720576788000001533154',0,1,3,274,7,1,1,NULL,0,NULL,'2025-03-27','2025-03-27 00:00:00','2025-09-30 12:48:00',NULL),
(87,'Oscar Patron','FED891','Ernesto','20448728316','3515302433','translogisticrm@gmail.com',0.00,'3108100900010002018118',0,2,3,274,8,1,1,NULL,0,NULL,'2025-07-14','2025-07-14 00:00:00','2025-10-14 18:23:22',NULL),
(88,'Ramiro Canevari','NUJ199','Galo','20396897661','3515228599','ramirocanevari24@gmail.com',0.00,'1',0,1,3,274,8,1,1,NULL,0,NULL,'2025-07-18','2025-07-18 00:00:00','2025-09-30 13:56:42',NULL),
(89,NULL,'RFF796','Lenis Justo Ezequiel','20319969196','3516799814','chelo-14@live.com.ar',0.00,'1',0,2,3,274,11,1,2,NULL,0,NULL,'2025-07-14','2025-07-14 00:00:00','2025-09-30 13:52:22',NULL),
(90,'Cardoso','AF556TS','Paola','27235809880','2994216468','alejandra3337@hotmail.com',0.00,'0440017240000230038464',0,1,3,5,1,1,1,NULL,0,'David gimenez alta','2025-06-03','2025-06-03 00:00:00','2025-09-30 13:43:44',NULL),
(91,'Sandoval','AB225JH','Pablo Eliseo','20361512376','2994705486','transportesandoval2025@gmail.com',0.00,'Pablo.e443',0,2,3,5,11,1,1,NULL,0,NULL,'2025-02-11','2025-02-11 00:00:00','2025-09-30 13:47:59',NULL),
(92,'Pierdominici','AD997FI','Sergio Oscar','20148003506','2996597669','Sergiopierdominici14@gmail.com',0.00,'0170089340000044646987',0,2,3,5,11,1,1,NULL,0,NULL,'2025-03-21','2025-03-21 00:00:00','2025-09-30 13:51:12',NULL),
(93,'Platino','MHW978','Natalia Alejandra','27333931872','1168204089','naty.platino88@gmail.com',0.00,'Efectivo',0,1,3,5,5,1,1,NULL,0,NULL,'2025-05-22','2025-05-22 00:00:00','2025-09-30 14:03:42',NULL),
(94,'Zorrilla Sanchez','AH066DM','Fermin','20188204806','3625286568','ferminzorrilla38@gmail.com',0.00,'1',0,1,3,275,5,1,1,NULL,0,NULL,'2025-06-27','2025-06-27 00:00:00','2025-09-30 16:16:14',NULL),
(95,'Aguirre','KBO958','Adolfo Nicolas','20377933045','3624333659','1@gmail.com',0.00,'1',0,1,3,275,7,1,1,NULL,0,NULL,'2025-07-18','2025-07-18 00:00:00','2025-09-30 14:46:09',NULL),
(96,NULL,'SJA293','Ibarra, Mariano','20377733534','3416757257','Marianogibarra@hotmail.com',0.00,'efectivo',0,2,3,281,8,3,2,NULL,0,NULL,'2025-04-22','2025-04-22 00:00:00','2025-09-30 15:21:12',NULL),
(97,'Luquez','LXQ625','Diego','20316977007','2983649406','diegoluquez615@gmail.com',0.00,'0140334103620551922009',0,1,3,276,7,1,1,NULL,0,NULL,'2025-04-08','2025-04-08 00:00:00','2025-09-30 15:24:29',NULL),
(98,NULL,'GSC281','Ferreyra Franco Bahiano','20455686564','1','1@gmail.com',0.00,'1',0,1,3,276,8,1,2,NULL,0,NULL,'2025-04-25','2025-04-25 00:00:00','2025-09-30 15:29:27',NULL),
(99,'Perea','AD613MI','Rodolfo Alejandro','20373098877','3813871478','rodolfoalejandroperea0@gmail.com',0.00,'efectivo',0,1,3,277,8,1,1,NULL,0,NULL,'2025-03-26','2025-03-26 00:00:00','2025-09-30 15:47:17',NULL),
(100,'Jimenez','AB702OE','Carlos Jose','20414259201','3816130312','1@gmail.com',0.00,'1',0,1,3,277,7,1,1,NULL,0,NULL,'2025-07-04','2025-07-04 00:00:00','2025-09-30 16:14:46',NULL),
(101,'Corbalan','AC518DE','Cristian','20293387762','3812060728','1@gmail.com',0.00,'0110405330040518207729',0,1,3,277,7,1,1,NULL,0,NULL,'2025-07-31','2025-07-31 00:00:00','2025-09-30 16:19:40',NULL),
(102,'Eusebi','NWL425','Santiago','20257817491','3424066482','1@gmail.com',0.00,'0000003100056389115527',0,1,3,278,5,1,1,NULL,0,NULL,'2025-07-17','2025-07-17 00:00:00','2025-09-30 16:25:48',NULL),
(104,'Oliva','LYJ244','Evelin','1','3425781200','1@gmail.com',0.00,'1',0,1,3,278,8,1,1,NULL,0,NULL,'2025-01-01','2025-01-01 00:00:00','2025-09-30 16:30:31',NULL),
(105,'Zeballos','IYS623','Cristian','20274929775','3424214306','1@gmail.com',0.00,'1',0,2,3,278,8,1,1,NULL,0,NULL,'2025-07-24','2025-07-24 00:00:00','2025-09-30 16:44:42',NULL),
(106,'Coppolecchia','NOV301','Jesus Ariel','20270737391','3462240196','1@gmail.com',0.00,'1',0,1,3,279,5,1,1,NULL,0,NULL,'2025-06-08','2025-06-08 00:00:00','2025-09-30 16:57:04',NULL),
(107,'Bruni','AF589FL','Ariel Jose','23220917649','3413244050','arielbruni@hotmail.com',0.00,'0110444230044440667451',0,1,13,NULL,2,1,1,NULL,0,NULL,'2025-06-12','2025-06-12 00:00:00','2025-09-30 17:51:39',NULL),
(108,'Vega','AE013HM','Pablo Matias','20310789020','3416192383','Pablo7387_@hotmail.com',0.00,'0340296408800008132000',0,1,13,NULL,9,1,1,NULL,0,NULL,'2025-06-17','2025-06-17 00:00:00','2025-09-30 17:59:34',NULL),
(109,'Alegre','A032RFF','Gaston Andres','20330723042','3625395014','gastonalegre87@gmail.com',0.00,'1',0,4,14,254,8,1,1,NULL,0,NULL,'2025-08-13','2025-08-13 00:00:00','2025-09-30 18:09:32',NULL),
(110,'Perez','AA148CZ','Hugo Dario','23312329409','3433007272','darioperezz338@gmail.com',0.00,'1',0,1,14,259,8,1,1,NULL,0,NULL,'2025-09-02','2025-09-02 00:00:00','2025-10-01 11:56:53',NULL),
(111,NULL,'NPQ270','Cristian Alesis Lopez','1','1','nicolas.casorati@gmail.com',0.00,'1',0,1,14,266,8,1,2,NULL,0,NULL,NULL,'2025-10-01 12:02:40','2025-10-01 12:02:40',NULL),
(112,'Kubiuk','NVV083','Oscar Marcelo','20323758604','3754476667','marcelokubiuk@gmail.com',0.00,'1',0,1,14,255,7,1,1,NULL,0,NULL,'2025-09-22','2025-09-22 00:00:00','2025-10-01 12:06:09',NULL),
(113,'Nicolas Sosa','GKY274','Rodrigo','20359000422','2236963481','rodrisurf91@gmail.com',0.00,'1',0,1,14,282,8,1,1,NULL,0,NULL,'2025-09-22','2025-09-22 00:00:00','2025-10-01 12:09:54',NULL),
(114,'Almiron','KRC730','Giuliana','27416775066','1130394943','giulianalmiron@gmail.com',0.00,'0290024710000050645461',0,1,13,NULL,9,1,1,NULL,0,NULL,'2025-07-04','2025-07-04 00:00:00','2025-10-01 14:12:38',NULL),
(115,'Benitez','JUS482','Juan Francisco','20316253645','1136465895','jfb.mu.in@gmail.com',0.00,'0140117803504756033820',0,1,13,92,2,1,1,NULL,0,NULL,'2025-07-24','2025-07-24 00:00:00','2025-10-01 14:31:12',NULL),
(116,'Vitolo','KNT387','Leonardo Gabriel','20363533109','1170141751','gabriel_310@hotmail.com.ar',0.00,'0140102403402560218919',0,1,13,92,5,1,1,NULL,0,NULL,'2025-04-24','2025-04-24 00:00:00','2025-10-01 14:34:43',NULL),
(117,NULL,'EQB160','Agustin Benegas','1','1150410890','transportemeloni@gmail.com',0.00,'1',0,3,3,271,19,1,2,NULL,0,NULL,'2025-07-24','2025-07-24 00:00:00','2025-10-01 14:39:49',NULL),
(118,'Cabana','BEJ734','Mario Alberto','27230463447','1150055366','mmarce.flores@gmail.com',0.00,'0170039840000034720196',1,3,13,92,19,1,1,NULL,0,NULL,'2025-06-04','2025-06-04 00:00:00','2025-10-01 14:43:55',NULL),
(119,'Puñales','LYS432','Brian Ezequiel','20923947680','1166093747','punalesbrian1@gmail.com',0.00,'0070391630004005214032',1,3,13,92,19,1,1,NULL,0,NULL,'2025-05-28','2025-05-28 00:00:00','2025-10-01 14:48:58',NULL),
(120,'Hernandez','NQS526','Diego David','23312059339','1130969711','dhervill@hotmail.com',0.00,'0070186630004015608614',0,1,13,92,5,1,1,NULL,0,NULL,'2025-05-08','2025-05-08 00:00:00','2025-10-01 17:35:31',NULL),
(121,'Rodriguez','NWY621','Ricardo Javier','20238120390','1133088055','javierdodgel7@gmail.com',0.00,'0070040530004090553449',1,2,13,NULL,8,1,1,NULL,0,NULL,'2025-06-05','2025-06-05 00:00:00','2025-10-01 18:01:52',NULL),
(122,'Galiano','BBD463','Gabriel Alejandro','20291870830','1157019142','g-galiano@hotmail.com',0.00,'0000003100005012371090',0,2,13,NULL,5,1,1,NULL,0,NULL,'2025-04-04','2025-04-04 00:00:00','2025-10-01 18:17:36',NULL),
(123,'Vela','LFL669','Juan Pedro','20281062728','3804242253','juanvela393@gmail.com',0.00,'0440014140000308991817',0,1,13,NULL,2,1,1,NULL,0,NULL,'2024-07-01','2024-07-01 00:00:00','2025-10-01 18:22:15',NULL),
(124,'Albarran','AB815GA','Marcelo Ariel','20261443962','2995050714','albarranmarceloa@gmail.com',0.00,'0070129330004895638343',0,1,13,NULL,1,1,1,NULL,0,NULL,'2025-07-17','2025-07-17 00:00:00','2025-10-01 18:52:18',NULL),
(125,NULL,'AH378OO','Julian Zinedine Pugh','1','2996746311','adm-3k@hotmail.com',0.00,'1',0,2,13,NULL,18,1,2,NULL,0,NULL,'2025-08-15','2025-08-15 00:00:00','2025-10-01 19:07:37',NULL),
(126,'Navallete','AC897PN','Guillermo','20387911279','2984254649','guillermonanav@live.com',0.00,'0000003100035041783429',0,1,13,NULL,2,1,1,NULL,0,NULL,'2025-06-12','2025-06-12 00:00:00','2025-10-01 19:16:34',NULL),
(127,'Nievas','AH339YW','Gonzalo Nahuel','33716733209','2995220931','adm-3k@hotmail.com',0.00,'0070147720000000323860',0,2,13,NULL,19,1,1,NULL,0,NULL,'2025-05-21','2025-05-21 00:00:00','2025-10-01 19:47:19',NULL),
(128,'Risini Flores','AD117WP','Ivana Maricel','27396813756','2994288941','ivanarisini30@gmail.com',0.00,'0000003100072581519367',0,2,13,NULL,22,1,1,NULL,0,NULL,'2024-12-11','2024-12-11 00:00:00','2025-10-01 19:52:09',NULL),
(129,'Millon Tello','MUW628','Andres Martin Raul','20304192780','2996592903','andresmillon30@gmail.com',0.00,'0110197930019788094083',1,1,13,NULL,4,1,1,NULL,0,NULL,'2025-02-17','2025-02-17 00:00:00','2025-10-01 19:58:52',NULL),
(130,'Burgi','KVW905','Ruben Adrian','23281863789','3492334125','burgiadri@gmail.com',0.00,'0000184305010007271971',1,1,13,94,2,1,1,NULL,0,NULL,'2025-07-11','2025-07-11 00:00:00','2025-10-01 20:02:44',NULL),
(131,'Rabellino','JEZ440','Luciano Ruben','20290543526','3492613410','lucianodarabellino@gmail.com',0.00,'1430001713038798790014',0,1,13,94,3,1,1,NULL,0,NULL,'2025-06-05','2025-06-05 00:00:00','2025-10-02 12:22:48',NULL),
(132,'Garbero','AA938IY','Hector Antonio','23109085669','3492208608','hectorgarbero7@gmail.com',0.00,'0070754330004000419715',0,1,13,94,7,1,1,NULL,0,NULL,'2025-06-19','2025-06-19 00:00:00','2025-10-02 12:26:38',NULL),
(133,'Gonzalez','NHU269','Juan Gabriel','20274842459','3492602306','puertoesperanza09@gmail.com',0.00,'0000003100093442787257',1,1,13,94,9,1,1,NULL,0,NULL,'2025-07-01','2025-07-01 00:00:00','2025-10-02 12:36:30',NULL),
(134,'Pieri','AA345WE','Lereley','27269313922','3492413229','pieriloreley@gmail.com',0.00,'0110423730042359400183',0,2,13,94,2,1,1,NULL,0,NULL,'2025-06-26','2025-06-26 00:00:00','2025-10-02 12:39:24',NULL),
(135,'Trionfini','AC719PY','Jorge Luis','20325116081','3492304726','trionfinij@gmail.com',0.00,'0720174188000041285972',1,1,13,94,3,1,1,NULL,0,NULL,'2025-07-10','2025-07-10 00:00:00','2025-10-02 12:43:20',NULL),
(136,'Sebastian Escudero','LEQ125','Rodrigo','23279964349','3624868610','escuderopichi@gmail.com',0.00,'0150517701000122249155',0,1,13,287,11,1,1,NULL,0,NULL,'2022-07-01','2022-07-01 00:00:00','2025-10-02 12:57:55',NULL),
(137,'Pablo Britos','CON746','Juan','20271875151','3625357180','prensa.britos@gmail.com',0.00,'1',1,2,13,287,3,1,1,NULL,0,NULL,'2025-04-21','2025-04-21 00:00:00','2025-10-02 12:57:32',NULL),
(138,'Vera','AC169UJ','Karina','27321907593','3735484125','karina19061986@hotmail.com',0.00,'0000229700000000161976',1,1,13,287,9,1,1,NULL,0,NULL,'2025-06-27','2025-06-27 00:00:00','2025-10-02 13:03:24',NULL),
(139,'Ruiz','AA802QR','Nestor Orlando','20137839297','3624046753','nestorruiz919@gmail.com',0.00,'Efectivo',1,1,13,287,11,1,1,NULL,0,NULL,'2022-07-01','2022-07-01 00:00:00','2025-10-02 13:07:56',NULL),
(140,'Martinez','AG326CC','Leandro','20257029574','3644459046','leoadrianmar434@gmail.com',0.00,'3110001211000015190040',1,2,13,287,2,1,1,NULL,0,NULL,'2025-07-22','2025-07-22 00:00:00','2025-10-02 13:12:41',NULL),
(141,NULL,'PHN094','Mauro Defina','27213406650','2477553636','naigenzano@gmail.com',0.00,'0070121730004188146951',1,1,13,95,3,1,2,NULL,0,NULL,'2025-02-06','2025-02-06 00:00:00','2025-10-02 13:26:15',NULL),
(142,'Ramirez','PAX682','Gabriel Maximiliano','27319953480','3434542068','melisaaguilar071@gmail.com',0.00,'4530000800010609088992',1,1,13,NULL,11,1,1,NULL,0,NULL,'2025-02-25','2025-02-25 00:00:00','2025-10-02 13:36:13',NULL),
(143,'Tarenco','HFU830','Carlos Gabriel','20338060883','3436133974','tarenco2.0@gmail.com',0.00,'0290000110000670361493',1,1,13,NULL,5,1,1,NULL,0,NULL,'2025-07-17','2025-07-17 00:00:00','2025-10-02 13:42:21',NULL),
(144,'Defant','AH318LR','Marco','20371276859','3584398159','ecpibe@gmail.com',0.00,'0110432930043228731447',1,1,13,NULL,2,1,1,NULL,0,NULL,'2025-06-17','2025-06-17 00:00:00','2025-10-02 15:14:15',NULL),
(145,'Lucero','LPH009','Maico Daniel','20374903161','358402713','maicolucero51@gmail.com',0.00,'1',0,1,13,NULL,9,1,1,NULL,0,NULL,'2025-09-24','2025-09-24 00:00:00','2025-10-02 15:30:15',NULL),
(146,'Acuavotta','PMA281','Alberto Martin','20314576390','3413161780','marthin085@hotmail.com',0.00,'3300028020280000842015',0,1,13,NULL,11,1,1,NULL,0,NULL,'2023-06-22','2023-06-22 00:00:00','2025-10-02 15:34:46',NULL),
(147,'Adorno','AE916YS','Federico','20257075657','3416560451','federicoadorno2012@gmail.com',0.00,'0000003100055171048559',0,1,13,NULL,3,1,1,NULL,0,NULL,'2025-06-03','2025-06-03 00:00:00','2025-10-02 15:39:45',NULL),
(148,'Aguzzi Colosio','AE585BS','Adrian Cesar','20289125524','3416189802','adrian_aguzzi@hotmail.com',0.00,'0340296408296000637003',0,1,13,NULL,3,3,1,NULL,0,NULL,'2025-06-02','2025-06-02 00:00:00','2025-10-02 17:33:28',NULL),
(149,'Arce','OLN113','Juan Manuel','20308089240','3413298834','juan.m.arce@hotmail.com',0.00,'1910274855127401799435',0,1,13,NULL,9,1,1,NULL,0,NULL,'2025-05-22','2025-05-22 00:00:00','2025-10-10 20:12:49',NULL),
(150,'Coa','wsed','Alonso','wsedrf','04129539917','silufigueroa@gmail.com',0.00,'wer',0,6,17,288,23,1,1,NULL,0,NULL,NULL,'2025-10-04 02:57:21','2025-10-06 11:37:39','2025-10-06 11:37:39'),
(151,'gimenez','HSH147','david','20339480096','3795018563','planetaeq@gmail.com',0.00,'1',1,1,13,97,3,1,1,NULL,0,NULL,'2024-08-10','2024-08-10 00:00:00','2025-10-09 17:10:20','2025-10-09 17:10:20'),
(152,'Arce','AF527VH','Leonel Gaston','20321288813','3413067326','leonel.g.arce@gmail.com',0.00,'0650080102000054813917',0,1,13,306,9,1,1,NULL,0,NULL,'2025-06-03','2025-06-03 00:00:00','2025-10-13 13:11:40',NULL),
(153,'Bordon','LUN807','Gustavo Raul','20283353444','3413723564','gusdrummer80@gmail.com',0.00,'0000003100002398713449',0,1,13,306,7,1,1,NULL,0,NULL,'2024-03-18','2024-03-18 00:00:00','2025-10-13 13:14:48',NULL),
(154,'Blotta','AH240WH','Ramon Ernesto','20287622237','03416639264','ramonesblotta@gmail.com',0.00,'0000003100026498549801',0,1,13,306,3,1,1,NULL,0,NULL,'2025-04-23','2025-04-23 00:00:00','2025-10-13 13:18:54',NULL),
(155,'Bolognese','AC614XQ','Ruben Marcelo','20431272297','03415904792','lautarob23@hotmail.com',0.00,'0000003100036347481518',0,1,13,306,2,1,1,NULL,0,NULL,'2025-06-05','2025-06-05 00:00:00','2025-10-13 13:26:14',NULL),
(156,'Bruni','AF589FL','Ariel Jose','23220917649','3413244050','arielbruni@hotmail.com',0.00,'0110444230044440667451',0,1,13,306,2,1,1,NULL,0,NULL,'2025-06-12','2025-06-12 00:00:00','2025-10-13 13:30:07',NULL),
(157,'Colacrai','AA890GX','Gustavo German','27469706023','3416591737','colacraigustavo@gmail.com',0.00,'0000003100085551758516',0,1,13,306,11,1,1,NULL,0,NULL,'2023-11-10','2023-11-10 00:00:00','2025-10-13 13:34:27',NULL),
(158,'Ciz','DWF207','Ariel Dario','20250024674','3413787406','arieldario83@gmail.com',0.00,'0270043420057404700038',1,2,13,306,3,1,1,NULL,0,NULL,'2025-05-07','2025-05-07 00:00:00','2025-10-13 13:36:54',NULL),
(159,'Cuello','HDD583','Nestor Ruben','20171524238','3416579826','nes69-@hotmail.com',0.00,'0720371688000001714586',0,2,13,306,3,1,1,NULL,0,NULL,'2025-05-19','2025-05-19 00:00:00','2025-10-13 13:43:35',NULL),
(160,NULL,'JJR686','Leonardo Andres D\'Accorso','1','3415931575','hernanjaimes85@gmail.com',0.00,'1',0,2,13,306,3,1,2,NULL,0,NULL,'2025-03-13','2025-03-13 00:00:00','2025-10-13 13:48:40',NULL),
(161,'Di Lorenzo','AC302FC','Sebastian','23350222529','3416248889','seb.dl@hotmail.com',0.00,'0070233330004031451102',0,2,13,306,3,1,1,NULL,0,NULL,'2025-06-19','2025-06-19 00:00:00','2025-10-13 13:52:27',NULL),
(162,'Jaeggi','FQD232','Kevin Jeremias','20468371597','3412610968','melettamatias05@gmail.com',0.00,'0070134730004005071721',0,2,13,306,9,1,1,NULL,0,NULL,'2025-06-11','2025-06-11 00:00:00','2025-10-13 13:55:12',NULL),
(163,'Estrada','KVR843','Nicolas Edgardo','20296864499','3413737353','nicolasestrada1@hotmail.com',0.00,'0000076500000008501789',1,1,13,306,3,1,1,NULL,0,NULL,'2024-11-28','2024-11-28 00:00:00','2025-10-13 13:58:26',NULL),
(164,NULL,'AA056GL','Diego Hernan Garcia','1','3412555321','Tomasajgonzalez@gmail.com',0.00,'1',0,1,13,306,2,1,2,NULL,0,NULL,'2025-06-27','2025-06-27 00:00:00','2025-10-13 14:10:24',NULL),
(165,'Gonzalez','JLE386','Tomas Alejandro','20416559350','03413626585','Tomasajgonzalez@gmail.com',0.00,'0720371688000002236168',1,2,13,306,2,1,1,NULL,0,NULL,'2025-08-06','2025-08-06 00:00:00','2025-10-13 14:12:32',NULL),
(166,'Glardon','AB419EW','Gabriel Eduardo','20242400489','3415996230','gabriel6970@hotmail.com',0.00,'2850369940094652078878',0,1,13,306,3,1,1,NULL,0,NULL,'2025-05-28','2025-05-28 00:00:00','2025-10-13 14:17:00',NULL),
(167,'Gomez','VPM076','Thiago  Nahuel','20452648947','03415104124','thiagoomg21@gmail.com',0.00,'2850672840095659080608',1,2,13,306,3,1,1,NULL,0,NULL,'2025-06-24','2025-06-24 00:00:00','2025-10-13 14:20:56',NULL),
(168,'Imperatrice','AH461GK','Hernan','20391225975','03415321790','Hernanimperatrice@hotmail.com',0.00,'0000003100031002841920',0,1,13,306,2,1,1,NULL,0,NULL,'2025-06-17','2025-06-17 00:00:00','2025-10-13 14:23:55',NULL),
(169,'Lacorte','AB559TO','Adrian Roberto','20321256466','03413113314','lacorteadrian@hotmail.com',0.00,'0170081740000047459225',0,1,13,306,9,1,1,NULL,0,NULL,'2025-06-25','2025-06-25 00:00:00','2025-10-13 14:25:55',NULL),
(170,'Leguiza','AA338VB','Hector','20391225444','03413797781','Hectorleguiza16@gmail.com',0.00,'2850672840095068801348',0,1,13,306,2,1,1,NULL,0,NULL,'2025-07-28','2025-07-28 00:00:00','2025-10-13 14:27:54',NULL),
(171,'Perfietto','AE458ZV','Ricardo Jesus','20325135590','3416670191','jesusperfietto@hotmail.com',0.00,'1910274855127402360467',0,1,13,306,9,1,1,NULL,0,NULL,'2025-08-04','2025-08-04 00:00:00','2025-10-14 12:41:59',NULL),
(172,'Ricci','AH226NT','Horacio Gabriel','20263562195','03416055761','Horacioricci614@gmail.com',0.00,'0000003100098020322491',0,1,13,306,3,1,1,NULL,0,NULL,'2025-05-22','2025-05-22 00:00:00','2025-10-13 15:13:28',NULL),
(173,'Strambi','MGI401','Hernan Dario','20335254504','3412261654','hernanstrambi19@gmail.com',0.00,'2850791240095870359228',0,1,13,306,3,1,1,NULL,0,NULL,'2025-06-05','2025-06-05 00:00:00','2025-10-13 15:18:26',NULL),
(174,'Velozo','AH473UP','Roberto Oscar','27435765918','3415055105','Robertooscar778@gmail.com',0.00,'0000003100031468789477',0,1,13,306,3,1,1,NULL,0,NULL,'2025-06-25','2025-06-25 00:00:00','2025-10-13 15:21:05',NULL),
(175,'Mojica','GSW442','Sergio Daniel','20238891532','3413807019','mojicasergio74@gmail.com',0.00,'Sergio.153.dorado.mp',0,1,13,306,2,1,1,NULL,0,NULL,'2024-02-02','2024-02-02 00:00:00','2025-10-13 15:24:11',NULL),
(176,'Oviedo Rivero','FXQ481','Veronica Ines','27261353194','3412786530','veroines777@yahoo.com.ar',0.00,'0110140530014034118951',0,1,13,306,9,1,1,NULL,0,NULL,'2025-05-20','2025-05-20 00:00:00','2025-10-13 15:28:05',NULL),
(177,'SAGLIMBENI','AF238IU','MAURO HECTOR','1','3415667720','maurithonewells10@gmail.com',0.00,'1',0,2,4,8,7,2,1,NULL,0,NULL,'2025-05-27','2025-05-27 00:00:00','2025-10-13 18:17:07',NULL),
(178,'Santarcangelo','AG158CS','Luis','20317924926','3413689555','emmasantarcangelo74@gmail.com',0.00,'0070704830004001928328',0,1,13,306,11,1,1,NULL,0,NULL,'2022-09-05','2022-09-05 00:00:00','2025-10-14 12:32:16',NULL),
(179,'Redigonda','AF330VO','Daniel Alejandro','27250797074','3416413419','flaco.leproso@hotmail.com',0.00,'0000076500000040710569',0,1,13,306,2,1,1,NULL,0,NULL,'2025-04-04','2025-04-04 00:00:00','2025-10-13 18:45:46',NULL),
(180,'Rinaldi','AF922HQ','Damian Francisco','27260059152','3415624036','rinaldidamian@yahoo.com.ar',0.00,'0720277588000037617154',0,1,13,306,9,1,1,NULL,0,NULL,'2025-05-28','2025-05-28 00:00:00','2025-10-13 18:50:03',NULL),
(181,'Riquelme','AH173BS','Diego Gustavo','27314962422','3412020758','duiegogustavo@gmail.com',0.00,'0000229700000000163224',0,1,13,306,3,3,1,NULL,0,NULL,'2025-05-28','2025-05-28 00:00:00','2025-10-13 18:54:28',NULL),
(182,'Sanchez','PNW746','Ezequiel Maximiliano','20345638726','3412148033','es6536180@gmail.com',0.00,'esanchez25.p24',0,1,13,306,3,1,1,NULL,0,NULL,'2025-06-19','2025-06-19 00:00:00','2025-10-13 18:58:14',NULL),
(183,'Vallejos','MGD077','Ezequiel Elias','20379010726','3413494218','vallejoseliaas@gmail.com',0.00,'0720478888000001745568',0,1,13,306,9,1,1,NULL,0,NULL,'2025-05-14','2025-05-14 00:00:00','2025-10-13 19:02:29',NULL),
(184,'Sosa','AF822IF','Miguel Angel','24321792908','3413887700','maroria36@gmail.com',0.00,'Maroria36',0,1,13,306,7,1,1,NULL,0,NULL,'2023-07-03','2023-07-03 00:00:00','2025-10-13 19:24:02',NULL),
(185,'Morell','ab019gu','Francisco','20311174178','03794012093','morellfrancisco@gmail.com',0.00,'8888888888888888888888',0,6,4,8,22,1,1,NULL,0,NULL,'2025-10-13','2025-10-13 00:00:00','2025-10-14 12:19:42',NULL),
(186,'Velazquez','TGT630','Emiliano Agustin','1','3517525858','velasquezemilianoagustin@gmail.com',0.00,'1',0,2,3,274,11,1,1,NULL,0,NULL,'2025-06-12','2025-06-12 00:00:00','2025-10-14 18:22:35',NULL),
(187,'Patron','EOV753','Maximo','1','3513256553','maximo.patron2003@gmail.com',0.00,'1',1,2,3,274,8,1,1,NULL,0,NULL,NULL,'2025-10-14 18:28:20','2025-10-14 18:28:20',NULL);
/*!40000 ALTER TABLE `personas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reclamo_archivo`
--

DROP TABLE IF EXISTS `reclamo_archivo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reclamo_archivo` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reclamo_id` bigint(20) unsigned NOT NULL,
  `archivo_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reclamo_archivo_reclamo_id_archivo_id_unique` (`reclamo_id`,`archivo_id`),
  KEY `reclamo_archivo_archivo_id_foreign` (`archivo_id`),
  CONSTRAINT `reclamo_archivo_archivo_id_foreign` FOREIGN KEY (`archivo_id`) REFERENCES `archivos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reclamo_archivo_reclamo_id_foreign` FOREIGN KEY (`reclamo_id`) REFERENCES `reclamos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reclamo_archivo`
--

LOCK TABLES `reclamo_archivo` WRITE;
/*!40000 ALTER TABLE `reclamo_archivo` DISABLE KEYS */;
INSERT INTO `reclamo_archivo` VALUES
(5,13,23,'2025-09-22 15:24:57','2025-09-22 15:24:57'),
(6,15,24,'2025-09-22 17:10:14','2025-09-22 17:10:14'),
(7,16,25,'2025-09-22 17:36:05','2025-09-22 17:36:05'),
(8,15,26,'2025-09-22 17:49:42','2025-09-22 17:49:42'),
(9,17,27,'2025-09-22 18:36:07','2025-09-22 18:36:07'),
(10,18,28,'2025-09-27 09:52:01','2025-09-27 09:52:01'),
(11,30,29,'2025-09-29 02:16:41','2025-09-29 02:16:41'),
(12,30,30,'2025-09-29 02:17:08','2025-09-29 02:17:08'),
(13,30,31,'2025-09-29 02:17:20','2025-09-29 02:17:20'),
(14,31,32,'2025-09-29 02:23:14','2025-09-29 02:23:14'),
(15,32,33,'2025-09-29 18:10:57','2025-09-29 18:10:57'),
(16,32,34,'2025-09-29 18:10:57','2025-09-29 18:10:57'),
(17,32,35,'2025-09-29 18:10:57','2025-09-29 18:10:57'),
(18,35,36,'2025-09-30 18:16:44','2025-09-30 18:16:44'),
(19,36,37,'2025-10-01 14:27:24','2025-10-01 14:27:24'),
(20,36,38,'2025-10-01 14:27:24','2025-10-01 14:27:24'),
(21,39,39,'2025-10-01 14:54:53','2025-10-01 14:54:53'),
(22,40,40,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(23,40,41,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(24,40,42,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(25,40,43,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(26,40,44,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(27,40,45,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(28,40,46,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(29,40,47,'2025-10-01 17:36:54','2025-10-01 17:36:54'),
(30,41,48,'2025-10-02 11:58:15','2025-10-02 11:58:15'),
(31,41,49,'2025-10-02 11:58:15','2025-10-02 11:58:15'),
(32,41,50,'2025-10-02 11:58:15','2025-10-02 11:58:15'),
(33,41,51,'2025-10-02 11:58:15','2025-10-02 11:58:15'),
(34,42,52,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(35,42,53,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(36,42,54,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(37,42,55,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(38,42,56,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(39,42,57,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(40,42,58,'2025-10-02 18:51:34','2025-10-02 18:51:34'),
(41,43,59,'2025-10-02 19:12:01','2025-10-02 19:12:01'),
(42,44,65,'2025-10-04 03:38:56','2025-10-04 03:38:56'),
(43,44,66,'2025-10-04 03:40:59','2025-10-04 03:40:59'),
(44,46,67,'2025-10-04 10:55:33','2025-10-04 10:55:33'),
(45,45,68,'2025-10-04 11:11:33','2025-10-04 11:11:33'),
(46,45,69,'2025-10-04 11:12:12','2025-10-04 11:12:12'),
(47,46,70,'2025-10-04 11:12:54','2025-10-04 11:12:54'),
(48,46,71,'2025-10-04 11:14:40','2025-10-04 11:14:40'),
(49,55,72,'2025-10-13 17:48:39','2025-10-13 17:48:39'),
(50,56,73,'2025-10-13 18:00:10','2025-10-13 18:00:10'),
(51,57,74,'2025-10-13 19:07:05','2025-10-13 19:07:05'),
(52,59,75,'2025-10-14 13:19:10','2025-10-14 13:19:10'),
(53,59,76,'2025-10-14 13:19:10','2025-10-14 13:19:10'),
(54,60,77,'2025-10-15 12:04:50','2025-10-15 12:04:50');
/*!40000 ALTER TABLE `reclamo_archivo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reclamo_comments`
--

DROP TABLE IF EXISTS `reclamo_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reclamo_comments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reclamo_id` bigint(20) unsigned NOT NULL,
  `creator_id` bigint(20) unsigned DEFAULT NULL,
  `sender_type` enum('persona','agente','sistema','creador','user') NOT NULL DEFAULT 'sistema',
  `sender_persona_id` bigint(20) unsigned DEFAULT NULL,
  `sender_user_id` bigint(20) unsigned DEFAULT NULL,
  `message` text NOT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reclamo_comments_reclamo_id_foreign` (`reclamo_id`),
  KEY `reclamo_comments_sender_persona_id_index` (`sender_persona_id`),
  KEY `reclamo_comments_sender_user_id_index` (`sender_user_id`),
  KEY `reclamo_comments_creator_id_index` (`creator_id`),
  CONSTRAINT `reclamo_comments_creator_id_foreign` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reclamo_comments_reclamo_id_foreign` FOREIGN KEY (`reclamo_id`) REFERENCES `reclamos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reclamo_comments_sender_persona_id_foreign` FOREIGN KEY (`sender_persona_id`) REFERENCES `personas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reclamo_comments_sender_user_id_foreign` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reclamo_comments`
--

LOCK TABLES `reclamo_comments` WRITE;
/*!40000 ALTER TABLE `reclamo_comments` DISABLE KEYS */;
INSERT INTO `reclamo_comments` VALUES
(54,13,1,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-22 15:24:57','2025-09-22 15:24:57',NULL),
(55,13,NULL,'agente',NULL,4,'Soluciona vos que arreglaste esa tarifa',NULL,'2025-09-22 15:27:29','2025-09-22 15:27:29',NULL),
(56,13,NULL,'agente',NULL,4,'Soluciona vos que arreglaste esa tarifa',NULL,'2025-09-22 15:28:07','2025-09-22 15:28:07',NULL),
(57,13,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-22 15:32:16','2025-09-22 15:32:16',NULL),
(58,13,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-09-22 15:32:41','2025-09-22 15:32:41',NULL),
(59,14,1,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-22 15:38:31','2025-09-22 15:38:31',NULL),
(60,15,6,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-22 17:09:30','2025-09-22 17:09:30',NULL),
(61,15,6,'creador',NULL,NULL,'Se carga reclamos',NULL,'2025-09-22 17:10:29','2025-09-22 17:10:29',NULL),
(62,15,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-22 17:10:33','2025-09-22 17:10:33',NULL),
(63,15,6,'creador',NULL,NULL,'Todo bien',NULL,'2025-09-22 17:11:12','2025-09-22 17:11:12',NULL),
(64,15,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-09-22 17:11:31','2025-09-22 17:11:31',NULL),
(65,15,6,'creador',NULL,NULL,'Reclamo solucionado',NULL,'2025-09-22 17:11:45','2025-09-22 17:11:45',NULL),
(66,15,6,'creador',NULL,NULL,'Reclamo solucionado',NULL,'2025-09-22 17:11:56','2025-09-22 17:11:56',NULL),
(67,16,1,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-22 17:36:04','2025-09-22 17:36:04',NULL),
(68,16,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-22 17:37:04','2025-09-22 17:37:04',NULL),
(69,16,1,'creador',NULL,NULL,'ya mande el email a urbano',NULL,'2025-09-22 17:37:24','2025-09-22 17:37:24',NULL),
(70,16,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-09-22 17:37:58','2025-09-22 17:37:58',NULL),
(71,16,1,'creador',NULL,NULL,'hola como estas?',NULL,'2025-09-22 17:38:34','2025-09-22 17:38:34',NULL),
(72,16,NULL,'sistema',NULL,NULL,'que pesado',NULL,'2025-09-22 17:42:28','2025-09-22 17:42:28',NULL),
(73,16,NULL,'sistema',NULL,NULL,'cat',NULL,'2025-09-22 17:42:39','2025-09-22 17:42:39',NULL),
(74,16,NULL,'sistema',NULL,NULL,'cat',NULL,'2025-09-22 17:42:49','2025-09-22 17:42:49',NULL),
(75,16,NULL,'sistema',NULL,NULL,'sfhbdfhbgdbfg',NULL,'2025-09-22 17:44:02','2025-09-22 17:44:02',NULL),
(76,17,1,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-22 18:36:06','2025-09-22 18:36:06',NULL),
(77,17,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-22 18:36:49','2025-09-22 18:36:49',NULL),
(78,17,1,'creador',NULL,NULL,'se mando el email jashdskjhdjlsahd',NULL,'2025-09-22 18:37:00','2025-09-22 18:37:00',NULL),
(79,17,1,'creador',NULL,NULL,'reclamo  se pargakñasjaskjf',NULL,'2025-09-22 18:38:06','2025-09-22 18:38:06',NULL),
(80,17,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-09-22 18:38:08','2025-09-22 18:38:08',NULL),
(81,14,1,'creador',NULL,NULL,'lsjahfljsahflsahfl',NULL,'2025-09-22 18:45:47','2025-09-22 18:45:47',NULL),
(82,18,18,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-24 17:50:27','2025-09-24 17:50:27',NULL),
(83,19,18,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-24 17:53:29','2025-09-24 17:53:29',NULL),
(84,20,1,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-24 18:01:50','2025-09-24 18:01:50',NULL),
(85,18,NULL,'sistema',NULL,NULL,'este es un comentario de prueba',NULL,'2025-09-26 15:59:02','2025-09-26 15:59:02',NULL),
(86,18,6,'agente',NULL,6,'creadossss',NULL,'2025-09-26 16:38:29','2025-09-26 16:38:29',NULL),
(87,18,NULL,'agente',NULL,NULL,'uno dos',NULL,'2025-09-26 16:39:16','2025-09-26 16:39:16',NULL),
(88,18,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-26 16:40:17','2025-09-26 16:40:17',NULL),
(89,18,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-09-26 16:41:47','2025-09-26 16:41:47',NULL),
(90,18,6,'agente',NULL,6,'ss',NULL,'2025-09-27 10:39:33','2025-09-27 10:39:33',NULL),
(91,29,6,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-27 10:58:32','2025-09-27 10:58:32',NULL),
(92,29,NULL,'agente',NULL,NULL,'ok',NULL,'2025-09-27 10:59:37','2025-09-27 10:59:37',NULL),
(93,30,6,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-29 02:16:02','2025-09-29 02:16:02',NULL),
(94,30,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-29 02:18:55','2025-09-29 02:18:55',NULL),
(95,20,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-29 02:19:19','2025-09-29 02:19:19',NULL),
(96,31,6,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-29 02:22:59','2025-09-29 02:22:59',NULL),
(97,31,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-29 02:23:27','2025-09-29 02:23:27',NULL),
(98,32,6,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-29 18:10:57','2025-09-29 18:10:57',NULL),
(99,32,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-29 18:11:26','2025-09-29 18:11:26',NULL),
(100,33,1,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-30 11:35:33','2025-09-30 11:35:33',NULL),
(101,33,2,'agente',NULL,2,'hola com estas',NULL,'2025-09-30 11:36:07','2025-09-30 11:36:07',NULL),
(102,33,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-09-30 11:36:23','2025-09-30 11:36:23',NULL),
(103,34,18,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-30 18:07:19','2025-09-30 18:07:19',NULL),
(104,35,12,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-09-30 18:16:44','2025-09-30 18:16:44',NULL),
(105,34,18,'agente',NULL,18,'hola',NULL,'2025-09-30 18:16:59','2025-09-30 18:16:59',NULL),
(106,36,12,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-01 14:27:23','2025-10-01 14:27:23',NULL),
(107,37,18,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-01 14:47:58','2025-10-01 14:47:58',NULL),
(108,38,18,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-01 14:54:36','2025-10-01 14:54:36',NULL),
(109,39,12,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-01 14:54:52','2025-10-01 14:54:52',NULL),
(110,36,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-01 17:09:16','2025-10-01 17:09:16',NULL),
(111,40,12,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-01 17:36:54','2025-10-01 17:36:54',NULL),
(112,41,18,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-02 11:58:14','2025-10-02 11:58:14',NULL),
(113,41,2,'agente',NULL,2,'se paso reclamo al email: RE: LOG ARGENTINA 2DA QUINCENA RSO',NULL,'2025-10-02 17:30:59','2025-10-02 17:30:59',NULL),
(114,41,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-02 17:31:02','2025-10-02 17:31:02',NULL),
(115,42,12,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-02 18:51:33','2025-10-02 18:51:33',NULL),
(116,43,12,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-02 19:12:00','2025-10-02 19:12:00',NULL),
(117,35,2,'agente',NULL,2,'Caso: 047185\nse paso el reclamo',NULL,'2025-10-02 19:35:04','2025-10-02 19:35:04',NULL),
(118,35,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-02 19:35:07','2025-10-02 19:35:07',NULL),
(119,43,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 03:04:22','2025-10-04 03:04:22',NULL),
(120,43,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 03:04:27','2025-10-04 03:04:27',NULL),
(121,43,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 03:05:11','2025-10-04 03:05:11',NULL),
(122,44,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-04 03:38:56','2025-10-04 03:38:56',NULL),
(123,44,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 03:40:30','2025-10-04 03:40:30',NULL),
(124,44,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-10-04 03:40:40','2025-10-04 03:40:40',NULL),
(125,44,6,'agente',NULL,6,'Ejemplo de mensaje',NULL,'2025-10-04 03:41:15','2025-10-04 03:41:15',NULL),
(126,45,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-04 10:46:49','2025-10-04 10:46:49',NULL),
(127,45,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 10:46:59','2025-10-04 10:46:59',NULL),
(128,45,6,'agente',NULL,6,'Atender el ticket de reclamo por favor',NULL,'2025-10-04 10:47:19','2025-10-04 10:47:19',NULL),
(129,46,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-04 10:55:32','2025-10-04 10:55:32',NULL),
(130,46,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 10:58:46','2025-10-04 10:58:46',NULL),
(131,46,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a solucionado',NULL,'2025-10-04 11:09:50','2025-10-04 11:09:50',NULL),
(132,46,6,'agente',NULL,6,'SIN OBSERVACIÓN',NULL,'2025-10-04 11:10:05','2025-10-04 11:10:05',NULL),
(133,47,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-04 20:12:30','2025-10-04 20:12:30',NULL),
(134,47,2,'agente',NULL,2,'ariel falta la imgen del reclamo',NULL,'2025-10-04 20:15:37','2025-10-04 20:15:37',NULL),
(135,47,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-04 20:16:08','2025-10-04 20:16:08',NULL),
(136,47,18,'agente',NULL,18,'ok monica te paso',NULL,'2025-10-04 20:16:57','2025-10-04 20:16:57',NULL),
(137,48,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-04 20:19:47','2025-10-04 20:19:47',NULL),
(138,48,2,'agente',NULL,2,'ariel te falto mandar el documento',NULL,'2025-10-04 20:21:09','2025-10-04 20:21:09',NULL),
(139,48,18,'agente',NULL,18,'ok moni te madno el coskñdjaskd',NULL,'2025-10-04 20:21:42','2025-10-04 20:21:42',NULL),
(140,48,2,'agente',NULL,2,'hola',NULL,'2025-10-06 11:10:48','2025-10-06 11:10:48',NULL),
(141,48,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-06 11:11:17','2025-10-06 11:11:17',NULL),
(142,37,2,'agente',NULL,2,'Buenos dias,aguardo la hoja del servicio como respaldo del dia. Gracias',NULL,'2025-10-06 11:57:38','2025-10-06 11:57:38',NULL),
(143,38,2,'agente',NULL,2,'Buenos dias\n25-9-25 se envio\n3-10-25 se consulta novedades, en espera de respuesta',NULL,'2025-10-06 11:59:52','2025-10-06 11:59:52',NULL),
(144,38,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-06 11:59:54','2025-10-06 11:59:54',NULL),
(145,49,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-06 12:39:51','2025-10-06 12:39:51',NULL),
(146,49,2,'agente',NULL,2,'no corresponde',NULL,'2025-10-06 12:41:17','2025-10-06 12:41:17',NULL),
(147,49,2,'agente',NULL,2,'m',NULL,'2025-10-06 12:42:20','2025-10-06 12:42:20',NULL),
(148,49,2,'agente',NULL,2,'hola',NULL,'2025-10-06 12:43:33','2025-10-06 12:43:33',NULL),
(149,49,18,'agente',NULL,18,'hola',NULL,'2025-10-06 12:43:49','2025-10-06 12:43:49',NULL),
(150,49,2,'agente',NULL,2,'holakashldasf',NULL,'2025-10-06 12:44:38','2025-10-06 12:44:38',NULL),
(151,49,2,'agente',NULL,2,',',NULL,'2025-10-06 12:45:54','2025-10-06 12:45:54',NULL),
(152,49,18,'agente',NULL,18,'jldwgflgdwljglkfghdñkf',NULL,'2025-10-06 12:47:28','2025-10-06 12:47:28',NULL),
(153,49,2,'agente',NULL,2,'.',NULL,'2025-10-06 12:47:58','2025-10-06 12:47:58',NULL),
(154,50,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-06 13:17:33','2025-10-06 13:17:33',NULL),
(155,50,2,'agente',NULL,2,'la slkdasklhflasf',NULL,'2025-10-06 13:17:45','2025-10-06 13:17:45',NULL),
(156,50,2,'agente',NULL,2,'ariel pasame lo que te pedi',NULL,'2025-10-06 13:18:26','2025-10-06 13:18:26',NULL),
(157,51,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-06 13:20:26','2025-10-06 13:20:26',NULL),
(158,52,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-06 13:22:25','2025-10-06 13:22:25',NULL),
(159,53,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-13 12:42:38','2025-10-13 12:42:38',NULL),
(160,53,2,'agente',NULL,2,'hola no funciona',NULL,'2025-10-13 12:43:00','2025-10-13 12:43:00',NULL),
(161,53,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-13 12:44:16','2025-10-13 12:44:16',NULL),
(162,53,2,'agente',NULL,2,'probando',NULL,'2025-10-13 12:45:27','2025-10-13 12:45:27',NULL),
(163,53,18,'agente',NULL,18,'probando',NULL,'2025-10-13 12:45:50','2025-10-13 12:45:50',NULL),
(164,53,2,'agente',NULL,2,'probando 2.0',NULL,'2025-10-13 12:46:22','2025-10-13 12:46:22',NULL),
(165,53,2,'agente',NULL,2,'probando 3.0',NULL,'2025-10-13 12:46:44','2025-10-13 12:46:44',NULL),
(166,53,2,'agente',NULL,2,'la cajeta de mudra',NULL,'2025-10-13 12:47:03','2025-10-13 12:47:03',NULL),
(167,54,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-13 12:47:46','2025-10-13 12:47:46',NULL),
(168,54,2,'agente',NULL,2,'probando',NULL,'2025-10-13 12:47:59','2025-10-13 12:47:59',NULL),
(169,54,2,'agente',NULL,2,'ok dale porbando',NULL,'2025-10-13 12:48:21','2025-10-13 12:48:21',NULL),
(170,55,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-13 17:47:14','2025-10-13 17:47:14',NULL),
(171,55,2,'agente',NULL,2,'ariel te falto lahoja de ruta',NULL,'2025-10-13 17:47:57','2025-10-13 17:47:57',NULL),
(172,55,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-13 17:48:07','2025-10-13 17:48:07',NULL),
(173,55,2,'agente',NULL,2,'liisto ya lo subo moni',NULL,'2025-10-13 17:48:55','2025-10-13 17:48:55',NULL),
(174,55,NULL,'sistema',NULL,NULL,'Estado cambiado de en proceso a rechazado',NULL,'2025-10-13 17:50:16','2025-10-13 17:50:16',NULL),
(175,55,NULL,'sistema',NULL,NULL,'Estado cambiado de rechazado a aceptado',NULL,'2025-10-13 17:50:20','2025-10-13 17:50:20',NULL),
(176,55,NULL,'sistema',NULL,NULL,'Estado cambiado de aceptado a en proceso',NULL,'2025-10-13 17:50:38','2025-10-13 17:50:38',NULL),
(177,55,12,'agente',NULL,12,'perfedctplslahdkashd',NULL,'2025-10-13 17:56:24','2025-10-13 17:56:24',NULL),
(178,56,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-13 17:58:38','2025-10-13 17:58:38',NULL),
(179,56,2,'agente',NULL,2,'hoaquin te olvidaste de mandar la hija de ruta',NULL,'2025-10-13 17:59:32','2025-10-13 17:59:32',NULL),
(180,56,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-13 17:59:39','2025-10-13 17:59:39',NULL),
(181,56,12,'agente',NULL,12,'monica ya te adjunte',NULL,'2025-10-13 18:00:25','2025-10-13 18:00:25',NULL),
(182,57,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-13 19:07:05','2025-10-13 19:07:05',NULL),
(183,56,2,'agente',NULL,2,'Favor de pasar el apellido distribuidor',NULL,'2025-10-13 19:32:20','2025-10-13 19:32:20',NULL),
(184,58,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-13 21:19:51','2025-10-13 21:19:51',NULL),
(185,59,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-14 13:19:10','2025-10-14 13:19:10',NULL),
(186,59,2,'agente',NULL,2,'mail :   Provisión 2da QUINCENA AGOSTO 25 - UEA CDO\nse paso solicitacion revisio del dia 25',NULL,'2025-10-14 17:47:39','2025-10-14 17:47:39',NULL),
(187,59,2,'agente',NULL,2,'la hoja del dia reclamo dice 23-6 y se reclama el 26-6. Favor de ver si es el dia o la hoja para reclamar. Aguardo confirmacion',NULL,'2025-10-14 17:49:20','2025-10-14 17:49:20',NULL),
(188,59,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-14 17:49:24','2025-10-14 17:49:24',NULL),
(189,57,2,'agente',NULL,2,'CASO 047349\nse paso el reclamo',NULL,'2025-10-14 17:58:30','2025-10-14 17:58:30',NULL),
(190,57,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-14 17:58:39','2025-10-14 17:58:39',NULL),
(191,37,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-14 18:17:01','2025-10-14 18:17:01',NULL),
(192,40,2,'agente',NULL,2,'la empresa comenta que el distribuidor debe reclamar a la otra empresa que se abono',NULL,'2025-10-14 18:17:57','2025-10-14 18:17:57',NULL),
(193,40,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a rechazado',NULL,'2025-10-14 18:18:05','2025-10-14 18:18:05',NULL),
(194,39,2,'agente',NULL,2,'se paso a la prefactura 526791 , se comento para el control, se aguarda su corroboracion para la gestion',NULL,'2025-10-14 18:25:24','2025-10-14 18:25:24',NULL),
(195,39,NULL,'sistema',NULL,NULL,'Estado cambiado de creado a en proceso',NULL,'2025-10-14 18:25:55','2025-10-14 18:25:55',NULL),
(196,38,2,'agente',NULL,2,'se reconocio los dias, el dia 1, comentan que no tienen registro (no hizo servicio) la hoja de ese dia tampoco se paso, si realizo pasar, aguardo confirmacion',NULL,'2025-10-14 19:03:28','2025-10-14 19:03:28',NULL),
(197,38,2,'agente',NULL,2,'aclaro de la primera quincena de agosto',NULL,'2025-10-14 19:04:22','2025-10-14 19:04:22',NULL),
(198,60,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:04:49','2025-10-15 12:04:49',NULL),
(199,61,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:09:44','2025-10-15 12:09:44',NULL),
(200,62,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:12:03','2025-10-15 12:12:03',NULL),
(201,63,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:30:10','2025-10-15 12:30:10',NULL),
(202,64,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:34:18','2025-10-15 12:34:18',NULL),
(203,65,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:39:33','2025-10-15 12:39:33',NULL),
(204,66,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:51:06','2025-10-15 12:51:06',NULL),
(205,67,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:52:16','2025-10-15 12:52:16',NULL),
(206,68,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:54:54','2025-10-15 12:54:54',NULL),
(207,69,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:56:42','2025-10-15 12:56:42',NULL),
(208,70,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 12:59:32','2025-10-15 12:59:32',NULL),
(209,71,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:03:04','2025-10-15 13:03:04',NULL),
(210,72,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:06:58','2025-10-15 13:06:58',NULL),
(211,73,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:09:21','2025-10-15 13:09:21',NULL),
(212,74,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:12:11','2025-10-15 13:12:11',NULL),
(213,75,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:16:27','2025-10-15 13:16:27',NULL),
(214,76,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:18:22','2025-10-15 13:18:22',NULL),
(215,77,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\": \"creado\"}','2025-10-15 13:33:22','2025-10-15 13:33:22',NULL),
(216,78,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\":\"creado\"}','2025-10-16 02:51:52','2025-10-16 02:51:52',NULL),
(217,79,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\":\"creado\"}','2025-10-16 04:49:19','2025-10-16 04:49:19',NULL),
(218,80,NULL,'sistema',NULL,NULL,'Reclamo creado inicialmente','{\"status\":\"creado\"}','2025-10-16 05:32:13','2025-10-16 05:32:13',NULL);
/*!40000 ALTER TABLE `reclamo_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reclamo_logs`
--

DROP TABLE IF EXISTS `reclamo_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reclamo_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reclamo_id` bigint(20) unsigned NOT NULL,
  `old_status` varchar(255) DEFAULT NULL,
  `new_status` varchar(255) DEFAULT NULL,
  `changed_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reclamo_logs_reclamo_id_foreign` (`reclamo_id`),
  KEY `reclamo_logs_changed_by_foreign` (`changed_by`),
  CONSTRAINT `reclamo_logs_changed_by_foreign` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reclamo_logs_reclamo_id_foreign` FOREIGN KEY (`reclamo_id`) REFERENCES `reclamos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reclamo_logs`
--

LOCK TABLES `reclamo_logs` WRITE;
/*!40000 ALTER TABLE `reclamo_logs` DISABLE KEYS */;
INSERT INTO `reclamo_logs` VALUES
(5,13,'creado','en_proceso',1,'2025-09-22 15:32:16','2025-09-22 15:32:16'),
(6,13,'en_proceso','finalizado',1,'2025-09-22 15:32:41','2025-09-22 15:32:41'),
(7,15,'creado','en_proceso',6,'2025-09-22 17:10:33','2025-09-22 17:10:33'),
(8,15,'en_proceso','finalizado',6,'2025-09-22 17:11:31','2025-09-22 17:11:31'),
(9,16,'creado','en_proceso',1,'2025-09-22 17:37:04','2025-09-22 17:37:04'),
(10,16,'en_proceso','finalizado',1,'2025-09-22 17:37:58','2025-09-22 17:37:58'),
(11,17,'creado','en_proceso',1,'2025-09-22 18:36:49','2025-09-22 18:36:49'),
(12,17,'en_proceso','finalizado',1,'2025-09-22 18:38:08','2025-09-22 18:38:08'),
(13,18,'creado','en_proceso',6,'2025-09-26 16:40:17','2025-09-26 16:40:17'),
(14,18,'en_proceso','finalizado',6,'2025-09-26 16:41:47','2025-09-26 16:41:47'),
(15,30,'creado','en_proceso',6,'2025-09-29 02:18:55','2025-09-29 02:18:55'),
(16,20,'creado','en_proceso',6,'2025-09-29 02:19:19','2025-09-29 02:19:19'),
(17,31,'creado','en_proceso',6,'2025-09-29 02:23:27','2025-09-29 02:23:27'),
(18,32,'creado','en_proceso',6,'2025-09-29 18:11:26','2025-09-29 18:11:26'),
(19,33,'creado','en_proceso',1,'2025-09-30 11:36:23','2025-09-30 11:36:23'),
(20,36,'creado','en_proceso',2,'2025-10-01 17:09:16','2025-10-01 17:09:16'),
(21,41,'creado','en_proceso',2,'2025-10-02 17:31:02','2025-10-02 17:31:02'),
(22,35,'creado','en_proceso',2,'2025-10-02 19:35:07','2025-10-02 19:35:07'),
(23,43,'creado','en_proceso',6,'2025-10-04 03:04:22','2025-10-04 03:04:22'),
(24,43,'creado','en_proceso',6,'2025-10-04 03:04:27','2025-10-04 03:04:27'),
(25,43,'creado','en_proceso',6,'2025-10-04 03:05:11','2025-10-04 03:05:11'),
(26,44,'creado','en_proceso',6,'2025-10-04 03:40:29','2025-10-04 03:40:29'),
(27,44,'en_proceso','finalizado',6,'2025-10-04 03:40:40','2025-10-04 03:40:40'),
(28,45,'creado','en_proceso',6,'2025-10-04 10:46:58','2025-10-04 10:46:58'),
(29,46,'creado','en_proceso',23,'2025-10-04 10:58:45','2025-10-04 10:58:45'),
(30,46,'en_proceso','finalizado',6,'2025-10-04 11:09:49','2025-10-04 11:09:49'),
(31,47,'creado','en_proceso',2,'2025-10-04 20:16:08','2025-10-04 20:16:08'),
(32,48,'creado','en_proceso',2,'2025-10-06 11:11:17','2025-10-06 11:11:17'),
(33,38,'creado','en_proceso',2,'2025-10-06 11:59:54','2025-10-06 11:59:54'),
(34,53,'creado','en_proceso',18,'2025-10-13 12:44:15','2025-10-13 12:44:15'),
(35,55,'creado','en_proceso',2,'2025-10-13 17:48:06','2025-10-13 17:48:06'),
(36,55,'en_proceso','rechazado',2,'2025-10-13 17:50:16','2025-10-13 17:50:16'),
(37,55,'rechazado','aceptado',2,'2025-10-13 17:50:19','2025-10-13 17:50:19'),
(38,55,'aceptado','en_proceso',2,'2025-10-13 17:50:37','2025-10-13 17:50:37'),
(39,56,'creado','en_proceso',2,'2025-10-13 17:59:38','2025-10-13 17:59:38'),
(40,59,'creado','en_proceso',2,'2025-10-14 17:49:23','2025-10-14 17:49:23'),
(41,57,'creado','en_proceso',2,'2025-10-14 17:58:39','2025-10-14 17:58:39'),
(42,37,'creado','en_proceso',2,'2025-10-14 18:17:00','2025-10-14 18:17:00'),
(43,40,'creado','rechazado',2,'2025-10-14 18:18:04','2025-10-14 18:18:04'),
(44,39,'creado','en_proceso',2,'2025-10-14 18:25:54','2025-10-14 18:25:54');
/*!40000 ALTER TABLE `reclamo_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reclamo_types`
--

DROP TABLE IF EXISTS `reclamo_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reclamo_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reclamo_types_nombre_unique` (`nombre`),
  UNIQUE KEY `reclamo_types_slug_unique` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reclamo_types`
--

LOCK TABLES `reclamo_types` WRITE;
/*!40000 ALTER TABLE `reclamo_types` DISABLE KEYS */;
INSERT INTO `reclamo_types` VALUES
(1,'Reclamo de pagos','reclamo-de-pagos','2025-09-20 14:01:00','2025-09-20 14:01:00',NULL),
(2,'Reclamo de liquidación','reclamo-de-liquidacion','2025-09-20 14:01:01','2025-09-20 14:01:01',NULL),
(3,'Reconocimiento de IVA','reconocimiento-de-iva','2025-09-20 14:01:01','2025-09-20 14:01:01',NULL),
(4,'Aumento de combustible','aumento-de-combustible','2025-09-20 14:01:01','2025-09-20 14:01:01',NULL),
(5,'Otros motivos','otros-motivos','2025-09-20 14:01:02','2025-09-20 14:01:02',NULL);
/*!40000 ALTER TABLE `reclamo_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reclamos`
--

DROP TABLE IF EXISTS `reclamos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reclamos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `creator_id` bigint(20) unsigned DEFAULT NULL,
  `persona_id` bigint(20) unsigned NOT NULL,
  `agente_id` bigint(20) unsigned DEFAULT NULL,
  `reclamo_type_id` bigint(20) unsigned NOT NULL,
  `detalle` text DEFAULT NULL,
  `fecha_alta` timestamp NULL DEFAULT NULL,
  `status` enum('creado','en_proceso','aceptado','rechazado','finalizado') NOT NULL DEFAULT 'creado',
  `pagado` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reclamos_agente_id_foreign` (`agente_id`),
  KEY `reclamos_reclamo_type_id_foreign` (`reclamo_type_id`),
  KEY `reclamos_persona_id_reclamo_type_id_status_index` (`persona_id`,`reclamo_type_id`),
  KEY `reclamos_creator_id_index` (`creator_id`),
  CONSTRAINT `reclamos_agente_id_foreign` FOREIGN KEY (`agente_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reclamos_creator_id_foreign` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reclamos_persona_id_foreign` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reclamos_reclamo_type_id_foreign` FOREIGN KEY (`reclamo_type_id`) REFERENCES `reclamo_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reclamos`
--

LOCK TABLES `reclamos` WRITE;
/*!40000 ALTER TABLE `reclamos` DISABLE KEYS */;
INSERT INTO `reclamos` VALUES
(13,1,14,4,1,'Ciz mauro pide el pago del 03/06 los $270.000 pesos que arreglo con  david',NULL,'finalizado',0,'2025-09-22 15:24:56','2025-09-24 17:41:04','2025-09-24 17:41:04'),
(14,1,13,3,1,'pagar',NULL,'creado',0,'2025-09-22 15:38:31','2025-09-24 17:41:01','2025-09-24 17:41:01'),
(15,6,14,1,4,NULL,NULL,'finalizado',0,'2025-09-22 17:09:30','2025-09-24 17:40:59','2025-09-24 17:40:59'),
(16,1,8,2,2,'Reclama el dia 15 de septiembrre',NULL,'finalizado',0,'2025-09-22 17:36:04','2025-09-24 17:40:56','2025-09-24 17:40:56'),
(17,1,9,2,1,'kjflkashfklhaslfkhaslkhf',NULL,'finalizado',0,'2025-09-22 18:36:06','2025-09-24 17:40:53','2025-09-24 17:40:53'),
(18,18,27,2,2,'La distribuidora  Cuenta con diferencia  en la liquidicacion los dias : 7 de agosto del 2025',NULL,'finalizado',0,'2025-09-24 17:50:27','2025-09-30 17:00:19','2025-09-30 17:00:19'),
(19,18,26,2,2,'EL distribuidor reclama las diferencias del día 7 y 15 de agosto del 2025',NULL,'creado',0,'2025-09-24 17:53:29','2025-09-30 17:00:17','2025-09-30 17:00:17'),
(20,1,43,2,4,'hola este reclamos es porkjahflasjhfasjfhjks que el dia 17 de septiembre no se le aumento el combustible',NULL,'en_proceso',0,'2025-09-24 18:01:50','2025-09-30 16:59:57','2025-09-30 16:59:57'),
(21,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:42:35','2025-09-27 10:59:08','2025-09-27 10:59:08'),
(22,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:42:37','2025-09-27 10:59:28','2025-09-27 10:59:28'),
(23,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:45:50','2025-09-27 10:59:26','2025-09-27 10:59:26'),
(24,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:45:52','2025-09-27 10:59:23','2025-09-27 10:59:23'),
(25,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:51:50','2025-09-27 10:59:21','2025-09-27 10:59:21'),
(26,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:51:55','2025-09-27 10:59:16','2025-09-27 10:59:16'),
(27,6,76,NULL,5,NULL,NULL,'creado',0,'2025-09-27 10:52:30','2025-09-27 10:59:13','2025-09-27 10:59:13'),
(28,6,76,NULL,5,'Consequuntur maiores',NULL,'creado',0,'2025-09-27 10:53:09','2025-09-27 10:59:19','2025-09-27 10:59:19'),
(29,6,76,NULL,5,'Consequuntur maiores',NULL,'creado',0,'2025-09-27 10:58:32','2025-09-27 14:22:55','2025-09-27 14:22:55'),
(30,6,76,NULL,5,'Sin detalles',NULL,'en_proceso',0,'2025-09-29 02:16:02','2025-09-30 16:59:54','2025-09-30 16:59:54'),
(31,6,76,1,3,'sin detalles del reclamo',NULL,'en_proceso',0,'2025-09-29 02:22:59','2025-09-30 16:59:51','2025-09-30 16:59:51'),
(32,6,76,2,4,'Detalle del reclamo',NULL,'en_proceso',0,'2025-09-29 18:10:57','2025-09-30 16:59:48','2025-09-30 16:59:48'),
(33,1,75,2,4,'khmvmkhgjhlkjñlk{lk{lk{ñk{{lj{ljln.,n\nkhlhñk\nñklkhlkh',NULL,'en_proceso',0,'2025-09-30 11:35:33','2025-09-30 16:59:45','2025-09-30 16:59:45'),
(34,18,107,2,2,'el distribuidor reclama el dia 9 de julio del plus que no se le abono, tiene eficiencia del 94%',NULL,'creado',0,'2025-09-30 18:07:19','2025-09-30 18:29:55','2025-09-30 18:29:55'),
(35,12,109,2,2,'Liquidación de Agosto - Falto abonar el dia 30 del mes',NULL,'en_proceso',0,'2025-09-30 18:16:44','2025-10-02 19:35:07',NULL),
(36,12,77,2,2,'Liquidación de segunda quincena de Julio - Falto abonar el dia 23 del mes',NULL,'en_proceso',0,'2025-10-01 14:27:23','2025-10-01 17:09:16',NULL),
(37,18,107,18,2,'Buenas tardes, el Distribuidor reclama el pago del plus por trabajar feriado y por contar con las condiciones del 80% o mas por el dia 9 de julio',NULL,'en_proceso',0,'2025-10-01 14:47:58','2025-10-14 18:17:01',NULL),
(38,18,23,18,2,'El distribuidor  reclama que no le pagaron los dias  1-2-6-7-8-9-11 de  la  primer quincena de Julio, se adjunto ya hojas de ruta',NULL,'en_proceso',0,'2025-10-01 14:54:36','2025-10-14 19:03:39',NULL),
(39,12,117,11,2,'Liquidación de primera quincena de Julio - Falto abonar el dia 3 del mes',NULL,'en_proceso',0,'2025-10-01 14:54:52','2025-10-14 18:25:57',NULL),
(40,12,84,2,2,'Liquidación de segunda quincena de Mayo - Falto abonar los días 16-19-20-21-22-23-27-28-30 (toda la quincena)',NULL,'rechazado',0,'2025-10-01 17:36:54','2025-10-14 18:18:05',NULL),
(41,18,108,2,2,'Diferencia- Detalle de Liquidacion- Urbano-Rosario : El distribuidor Reclama la diferencia de Porcentaje de eficiencia ya que esta visto que hizo el recorrido total, es decir visito a todas las paradas pero por motivos ajenos a el no lo pudo entregar a todos los paquetes, adjunto caratulas de los dias en cuestion : 21/08 -22/08-28/08-29/09 \nCorrespondientes a la Segunda Quincena de Agosto',NULL,'en_proceso',0,'2025-10-02 11:58:14','2025-10-06 11:14:01','2025-10-06 11:14:01'),
(42,12,96,2,2,'Liquidación de primer quincena de Agosto - Falto abonar los días 4-5-7-8-11-12-13 (servicios de Colecta P.M.)',NULL,'creado',0,'2025-10-02 18:51:33','2025-10-04 03:05:55','2025-10-04 03:05:55'),
(43,12,50,2,2,'Liquidación de Agosto - Falto abonar el dia 27 del mes',NULL,'creado',0,'2025-10-02 19:12:00','2025-10-04 03:05:38','2025-10-04 03:05:38'),
(44,NULL,150,6,5,'Ejemplo','2025-10-03 00:00:00','finalizado',0,'2025-10-04 03:38:55','2025-10-06 11:13:43','2025-10-06 11:13:43'),
(45,NULL,150,NULL,4,NULL,NULL,'en_proceso',0,'2025-10-04 10:46:48','2025-10-06 11:13:48','2025-10-06 11:13:48'),
(46,NULL,150,23,3,NULL,'2025-10-06 00:00:00','finalizado',0,'2025-10-04 10:55:32','2025-10-06 11:13:51','2025-10-06 11:13:51'),
(47,NULL,150,2,4,'prueba','2025-07-10 00:00:00','en_proceso',0,'2025-10-04 20:12:29','2025-10-06 11:13:54','2025-10-06 11:13:54'),
(48,NULL,148,2,3,'prueba 2','2025-08-21 00:00:00','en_proceso',0,'2025-10-04 20:19:47','2025-10-06 11:14:04','2025-10-06 11:14:04'),
(49,NULL,27,2,2,'Liquidacion- Santa fe- esta con muchas complicaciones por los dias que no le pagan esta podrida','2025-07-15 00:00:00','creado',0,'2025-10-06 12:39:51','2025-10-06 12:48:21','2025-10-06 12:48:21'),
(50,NULL,147,2,2,'adfdsfdsg','2025-08-15 00:00:00','creado',0,'2025-10-06 13:17:32','2025-10-06 13:21:33','2025-10-06 13:21:33'),
(51,NULL,146,2,4,NULL,NULL,'creado',0,'2025-10-06 13:20:25','2025-10-06 13:21:36','2025-10-06 13:21:36'),
(52,NULL,145,22,2,NULL,'2025-10-05 00:00:00','creado',0,'2025-10-06 13:22:25','2025-10-06 13:24:40','2025-10-06 13:24:40'),
(53,NULL,149,2,4,NULL,NULL,'en_proceso',0,'2025-10-13 12:42:37','2025-10-13 12:47:29','2025-10-13 12:47:29'),
(54,NULL,147,2,4,NULL,NULL,'creado',0,'2025-10-13 12:47:45','2025-10-13 12:53:34','2025-10-13 12:53:34'),
(55,NULL,156,12,2,'falta dia 15 de septiembre','2025-10-10 00:00:00','en_proceso',1,'2025-10-13 17:47:13','2025-10-13 17:57:03','2025-10-13 17:57:03'),
(56,NULL,153,2,2,'xzczxvv','2025-10-05 00:00:00','en_proceso',0,'2025-10-13 17:58:37','2025-10-14 12:14:10','2025-10-14 12:14:10'),
(57,NULL,50,2,2,'Liquidación del mes de Agosto - Falto abonar el día 27 del mes',NULL,'en_proceso',0,'2025-10-13 19:07:04','2025-10-14 17:58:39',NULL),
(58,NULL,50,18,5,NULL,NULL,'creado',0,'2025-10-13 21:19:50','2025-10-13 21:20:10','2025-10-13 21:20:10'),
(59,NULL,61,18,2,'Liquidacion-URBANO-  CORDOBA : El distribuidor De cordoba esta reclamando 12 mil pesos que fue mal liquidado  del dia 26/06   y del dia 25/08/2025 tambien indica que estaria mal liquidado ya que le facturaron 130.932,63  y el tramito 182.651,02, desde ya muchas gracias',NULL,'en_proceso',0,'2025-10-14 13:19:09','2025-10-14 17:49:42',NULL),
(60,NULL,187,2,2,'gdsgsdgsdg',NULL,'creado',0,'2025-10-15 12:04:49','2025-10-15 12:05:23','2025-10-15 12:05:23'),
(61,NULL,61,NULL,1,'Reclamo de prueba desde curl con autenticación',NULL,'creado',0,'2025-10-15 12:09:44','2025-10-15 12:55:41','2025-10-15 12:55:41'),
(62,NULL,61,NULL,1,'Reclamo de prueba con auth(sanctum)',NULL,'creado',0,'2025-10-15 12:12:03','2025-10-15 12:55:48','2025-10-15 12:55:48'),
(63,NULL,61,NULL,1,'Reclamo test después de agregar sanctum guard',NULL,'creado',0,'2025-10-15 12:30:10','2025-10-15 12:55:50','2025-10-15 12:55:50'),
(64,NULL,61,NULL,1,'Reclamo forzado con guard Sanctum',NULL,'creado',0,'2025-10-15 12:34:18','2025-10-15 12:56:08','2025-10-15 12:56:08'),
(65,NULL,61,NULL,1,'Reclamo después de restaurar Kernel.php',NULL,'creado',0,'2025-10-15 12:39:33','2025-10-15 12:55:53','2025-10-15 12:55:53'),
(66,NULL,61,NULL,1,'Reclamo final con creator_id',NULL,'creado',0,'2025-10-15 12:51:06','2025-10-15 12:56:05','2025-10-15 12:56:05'),
(67,NULL,61,NULL,1,'Reclamo final con creator_id',NULL,'creado',0,'2025-10-15 12:52:16','2025-10-15 12:56:01','2025-10-15 12:56:01'),
(68,NULL,61,NULL,1,'Reclamo con creator_id después del Kernel',NULL,'creado',0,'2025-10-15 12:54:54','2025-10-15 12:55:58','2025-10-15 12:55:58'),
(69,NULL,185,22,2,'zrgrstesry','2025-10-15 00:00:00','creado',0,'2025-10-15 12:56:41','2025-10-15 13:18:00','2025-10-15 13:18:00'),
(70,NULL,61,NULL,1,'Reclamo con creator_id OK',NULL,'creado',0,'2025-10-15 12:59:32','2025-10-15 13:17:58','2025-10-15 13:17:58'),
(71,NULL,61,NULL,1,'Reclamo con creator_id funcionando',NULL,'creado',0,'2025-10-15 13:03:04','2025-10-15 13:17:48','2025-10-15 13:17:48'),
(72,NULL,61,NULL,1,'Reclamo con Sanctum activo',NULL,'creado',0,'2025-10-15 13:06:58','2025-10-15 13:17:45','2025-10-15 13:17:45'),
(73,NULL,61,NULL,1,'Reclamo con Sanctum OK y creator_id',NULL,'creado',0,'2025-10-15 13:09:21','2025-10-15 13:17:40','2025-10-15 13:17:40'),
(74,NULL,61,NULL,1,'Reclamo con Auth::shouldUse funcionando',NULL,'creado',0,'2025-10-15 13:12:11','2025-10-15 13:17:38','2025-10-15 13:17:38'),
(75,NULL,61,NULL,1,'Reclamo tras registrar Kernel y middleware',NULL,'creado',0,'2025-10-15 13:16:27','2025-10-15 13:17:35','2025-10-15 13:17:35'),
(76,NULL,185,22,2,'rthrtdhgdhdfgh','2025-10-15 00:00:00','creado',0,'2025-10-15 13:18:21','2025-10-15 13:18:21',NULL),
(77,NULL,185,22,4,'kjhvfjmhv',NULL,'creado',0,'2025-10-15 13:33:21','2025-10-15 13:33:21',NULL),
(78,NULL,185,22,4,'ddgsrgsfdgsdfg','2025-10-16 03:00:00','creado',0,'2025-10-16 02:51:52','2025-10-16 02:51:52',NULL),
(79,NULL,185,18,4,'ergdsfdgsd','2025-10-15 03:00:00','creado',0,'2025-10-16 04:49:19','2025-10-16 04:49:19',NULL),
(80,NULL,185,12,4,'rtrgretg',NULL,'creado',0,'2025-10-16 05:32:13','2025-10-16 05:32:13',NULL);
/*!40000 ALTER TABLE `reclamos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_has_permissions`
--

DROP TABLE IF EXISTS `role_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_foreign` (`role_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_has_permissions`
--

LOCK TABLES `role_has_permissions` WRITE;
/*!40000 ALTER TABLE `role_has_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES
(1,'admin','web','2025-09-11 05:37:17','2025-09-11 05:37:17'),
(2,'Gerencia','web','2025-09-11 05:37:17','2025-09-11 05:37:17'),
(3,'Encargado','web','2025-09-11 05:37:17','2025-09-11 05:37:17'),
(4,'Asesor','web','2025-09-11 05:37:17','2025-09-11 05:37:17'),
(5,'Agente de Venta','web','2025-09-11 05:37:17','2025-09-11 05:37:17'),
(6,'Administracion','web',NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES
('2a4qX6LsYCcHOxBcs3nSo2wPelskHjzUmpxhjkbe',12,'190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','YTozOntzOjY6Il90b2tlbiI7czo0MDoiU2NHV0JnbHhPaGVwYXl1cGtqMFhoODVaQldRUUNmWkJUSGVnZzdpZSI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6NTY6Imh0dHBzOi8vYXBpLWxvZ2lzdGljYS5jcnV6bmVncmFkZXYuY29tL2FwaS9yZWNsYW1vLXR5cGVzIjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1760552812),
('bXtYQNWq2XVwYEzJuONoHvTNpm8pdG8VoVQqYKoP',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiZU96MjdZdHo0bzBkUWpvWTdwbHlTZmMzejRraFRoM0JNUHZrcE0xYSI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7fXM6NjoiX2ZsYXNoIjthOjI6e3M6Mzoib2xkIjthOjA6e31zOjM6Im5ldyI7YTowOnt9fX0=',1760614672),
('Cu7RqdKOMrl5ZU0MYdosDTtywgYQAbZ1RLrABbaL',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiUHNpNjhablozQ3ZVbloyeFNtMUNRWEZ3akExNkZhWXNKR3FLYmFBbCI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7fXM6NjoiX2ZsYXNoIjthOjI6e3M6Mzoib2xkIjthOjA6e31zOjM6Im5ldyI7YTowOnt9fX0=',1760615569),
('FnHfzjoAu8x1Kvjui0wVM5hCuNfu0oke6TSskpRd',NULL,'190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YToyOntzOjY6Il90b2tlbiI7czo0MDoiWkc5TklCSEw5a0oybHUwWlNNWnlBd3R1T3NLVUZzRWpteWJ5enlGRCI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1760552764),
('fpn3Zb7algpkIKE0S3wbNriLHbsLSTCzsj5urgbU',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiWk1odHNvRTB2RTVNbE80dEZFVjAzdmtSNnE3ZFBDYlNMRGdiMFRBUSI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7fXM6NjoiX2ZsYXNoIjthOjI6e3M6Mzoib2xkIjthOjA6e31zOjM6Im5ldyI7YTowOnt9fX0=',1760615592),
('GRDUGD4p6x34TgffLOQYaWFNdYL8FF1RDVfRHPvE',NULL,'190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YToyOntzOjY6Il90b2tlbiI7czo0MDoidW1BaXRyc0xOUjFZclNxQllwcHF1MmJjN2JEZ3FIdFpoeTNkS1E0ZyI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1760552663),
('HgWvjCLtM5slL6rWm8A2lHAcGyoO2KBEW5k2Rmj9',NULL,'190.16.167.210','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YToyOntzOjY6Il90b2tlbiI7czo0MDoicTBZdU9lelZJb1V2ZUJkQVJPd2phdFk0Vnlhc21lSDQ4am5pZExuNSI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1760552372),
('HMs4JdpwclCEnIce3sXIP9oFFsTvKrZJNekBxeH9',12,'190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','YTozOntzOjY6Il90b2tlbiI7czo0MDoiOG13b0JtOTlWV2VYRlJxUHRlZkdoMVNKQk43S2I3STQ2QWNSM1VyayI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6NzA6Imh0dHBzOi8vYXBpLWxvZ2lzdGljYS5jcnV6bmVncmFkZXYuY29tL2FwaS9yZWNsYW1vcz9wYWdlPTEmcGVyX3BhZ2U9MTUiO31zOjY6Il9mbGFzaCI7YToyOntzOjM6Im9sZCI7YTowOnt9czozOiJuZXciO2E6MDp7fX19',1760552812),
('nw3NgQKMEnry0JOSLsLQ6Oh06gSYUe2fJJUX2sbA',12,'190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','YTozOntzOjY6Il90b2tlbiI7czo0MDoiejB1bkE0eUI4cXpCZ2Z4ZW9kNnhYdHcyS081VmhDeENkVUlNdkZ2ZiI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6NjQ6Imh0dHBzOi8vYXBpLWxvZ2lzdGljYS5jcnV6bmVncmFkZXYuY29tL2FwaS9wZXJzb25hbD9wZXJfcGFnZT0yMDAiO31zOjY6Il9mbGFzaCI7YToyOntzOjM6Im9sZCI7YTowOnt9czozOiJuZXciO2E6MDp7fX19',1760552812),
('RYjL0WeekgMWBKGKqZJ33HvAyfFCdsk0gaHZdBEp',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiaGhVZk5aZ0t0TEhrWEx4NmZ2U0IzcEdGSGhNTVdNNnNSNkNneFczMyI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7fXM6NjoiX2ZsYXNoIjthOjI6e3M6Mzoib2xkIjthOjA6e31zOjM6Im5ldyI7YTowOnt9fX0=',1760570509),
('SFOmGnJtB7HWHbyXPXSd08aMHT3RtY1wELmVihPN',12,'190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','YTozOntzOjY6Il90b2tlbiI7czo0MDoieEtNMHR6bm94S2o3TUpvTk52cE1QU2VGanpHeDJ0RnpZczRWWHZTQiI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6NjY6Imh0dHBzOi8vYXBpLWxvZ2lzdGljYS5jcnV6bmVncmFkZXYuY29tL2FwaS9hdXRoL3VzZXJzP3Blcl9wYWdlPTQwMCI7fXM6NjoiX2ZsYXNoIjthOjI6e3M6Mzoib2xkIjthOjA6e31zOjM6Im5ldyI7YTowOnt9fX0=',1760552812),
('xX6T1fQ8UEgqcGlrdKXXwxlykki4mIXjvyXqEO3h',12,'190.16.167.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0','YTozOntzOjY6Il90b2tlbiI7czo0MDoicXFoSllWMmhCanU4MldOZlJ0TWVCS2x1cERpMDJzanZQQm5CNHhGWiI7czo5OiJfcHJldmlvdXMiO2E6MTp7czozOiJ1cmwiO3M6Nzk6Imh0dHBzOi8vYXBpLWxvZ2lzdGljYS5jcnV6bmVncmFkZXYuY29tL2FwaS9ub3RpZmljYXRpb25zP3Blcl9wYWdlPTEmcmVhZD11bnJlYWQiO31zOjY6Il9mbGFzaCI7YToyOntzOjM6Im9sZCI7YTowOnt9czozOiJuZXciO2E6MDp7fX19',1760552812);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sucursals`
--

DROP TABLE IF EXISTS `sucursals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sucursals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint(20) unsigned DEFAULT NULL,
  `nombre` text DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sucursals_cliente_id_foreign` (`cliente_id`),
  CONSTRAINT `sucursals_cliente_id_foreign` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=316 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sucursals`
--

LOCK TABLES `sucursals` WRITE;
/*!40000 ALTER TABLE `sucursals` DISABLE KEYS */;
INSERT INTO `sucursals` VALUES
(1,1,'Sarandi','hkjshdkjas','2025-09-15 14:36:42','2025-09-15 14:36:42',NULL),
(2,1,'Moreno','564654654','2025-09-15 14:36:43','2025-09-15 14:36:43',NULL),
(3,2,'Venado tuerto','32165564','2025-09-15 17:13:00','2025-09-15 17:13:00',NULL),
(4,2,'Rosario','1564648949','2025-09-15 17:13:00','2025-09-15 17:13:00',NULL),
(5,3,'Neuquen','6654654987','2025-09-15 17:13:57','2025-09-15 17:13:57',NULL),
(6,3,'Barranqueras','564654894','2025-09-15 17:13:57','2025-09-15 17:13:57',NULL),
(7,4,'Munro','6546568798','2025-09-15 18:22:25','2025-09-15 18:22:25',NULL),
(8,4,'Rosario','6545465465','2025-09-15 18:22:25','2025-09-15 18:22:25',NULL),
(9,13,'Bahia Blanca','Maldonado 1176','2025-09-16 16:57:54','2025-09-16 16:58:46','2025-09-16 16:58:46'),
(10,13,'Cordoba','Av La Voz del interior 6020','2025-09-16 16:57:54','2025-09-16 16:58:46','2025-09-16 16:58:46'),
(11,13,'Corrientes','Av. Independencia 4867','2025-09-16 16:57:54','2025-09-16 16:58:46','2025-09-16 16:58:46'),
(15,13,'Parana','Ruta 18 avenida almafuerte km13,5 area empresarial alto avellaneda nave 12','2025-09-16 16:58:46','2025-09-16 17:00:12','2025-09-16 17:00:12'),
(16,13,'Mendoza','fangio 599 godoy cruz','2025-09-16 16:58:46','2025-09-16 17:00:12','2025-09-16 17:00:12'),
(17,13,'Chaco','\"Avenida Republica del Israel 2502. recibe gente Paso de la Patria 2551, H3506 Resistencia, Chaco salen las camionetas  https://maps.app.goo.gl/Gts8AJDxuNSLa5yZ9\"','2025-09-16 16:58:46','2025-09-16 17:00:12','2025-09-16 17:00:12'),
(24,13,'Rio Cuarto','Paso de los Andes 181','2025-09-16 17:00:12','2025-09-18 11:37:37','2025-09-18 11:37:37'),
(25,13,'Rosario','Circunvalacion 392 bis. JUAN PABLO II 392 BIS, ESQUINA GORRITI','2025-09-16 17:00:12','2025-09-18 11:37:37','2025-09-18 11:37:37'),
(26,13,'Salta','\" Avenida Ernesto Delgadillo 841. Barrio parque industrial\"','2025-09-16 17:00:12','2025-09-18 11:37:37','2025-09-18 11:37:37'),
(27,14,'Bahia Blanca','Don Bosco 2695','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(28,14,'Cordoda','Av. Cincumbalacion','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(29,14,'Entre Rios','Sud América 1145','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(30,14,'Formosa','Córdoba 211, cp: 3600','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(31,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(32,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(33,14,'Santa Fe','Santa Fe coronel bogado','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(34,14,'Tucuman','Lavalle 2646','2025-09-17 12:59:12','2025-09-22 13:12:23','2025-09-22 13:12:23'),
(44,13,'Santa Fe','Mariano Comas 3332','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(45,13,'Tucuman','Gobernador del Campo 1041. Camilo Habid','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(46,13,'Neuquen','Giuseppe Mazzaro 2240, parque Industrial','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(47,13,'Rosario','Circunvalacion 392 bis','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(48,13,'La Rioja','Calle David Gatica y Maria Eugenia Ruarte','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(49,13,'Bariloche','Gallardo 1045, Bariloche','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(50,13,'Villa Ballester','parque industrial newton, aparece en google( Gral Roca 4765)','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(51,13,'Sarandi','Beguiristain 243 esquina Av Roca, Sarandi','2025-09-18 11:37:37','2025-09-18 13:40:39','2025-09-18 13:40:39'),
(69,13,'Berazategui','Av. 14 número 3707 uf 021 berazategui','2025-09-18 13:40:40','2025-09-18 13:43:34','2025-09-18 13:43:34'),
(70,13,'Moreno','Belisario roldan 2616.','2025-09-18 13:40:40','2025-09-18 13:43:34','2025-09-18 13:43:34'),
(71,13,'San Nicolas','\"av central acero argentino oeste 635 comirsa uno frente de siderar https://www.google.com/maps?q=-33.3851125,-60.1620291\"','2025-09-18 13:40:40','2025-09-18 13:43:34','2025-09-18 13:43:34'),
(92,13,'La Tablada','calle Bradsen 5198','2025-09-18 13:43:34','2025-09-18 13:43:34',NULL),
(93,13,'Catamarca','\"calle av. Nestor Kichner. ruta 38.  https://www.google.com/maps?q=-28.482011,-65.7407841\"','2025-09-18 13:43:34','2025-09-25 18:58:29','2025-09-25 18:58:29'),
(94,13,'Rafaela','Calle 9 de Julio 933 - 2300 RAFAELA','2025-09-18 13:43:34','2025-09-18 13:43:34',NULL),
(95,13,'Pergamino','Dr. Ricardo Balbin 340 - B2700CPA - Pergamino - Buenos Aires','2025-09-18 13:43:34','2025-09-18 13:43:34',NULL),
(96,13,'Hudson','AV. RIGOLLEAU Nº 3707 (AV. 14)','2025-09-18 13:43:34','2025-09-18 13:43:34',NULL),
(97,13,'La Pampa','calle Apostol 545','2025-09-18 13:43:34','2025-09-18 13:43:34',NULL),
(98,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(99,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(100,14,'Entre Rios','Sud América 1145','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(101,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(102,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(103,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(104,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(105,14,'Tucuman','Lavalle 2646','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(106,14,'22','22','2025-09-22 13:12:23','2025-09-22 13:12:27','2025-09-22 13:12:27'),
(107,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:12:27','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(108,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:12:27','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(109,14,'Entre Rios','Sud América 1145','2025-09-22 13:12:27','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(110,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:12:27','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(111,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:12:27','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(112,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:12:27','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(113,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:12:28','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(114,14,'Tucuman','Lavalle 2646','2025-09-22 13:12:28','2025-09-22 13:18:06','2025-09-22 13:18:06'),
(115,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(116,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(117,14,'Entre Rios','Sud América 1145','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(118,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(119,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(120,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(121,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(122,14,'Tucuman','Lavalle 2646','2025-09-22 13:18:06','2025-09-22 13:19:17','2025-09-22 13:19:17'),
(123,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(124,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(125,14,'Entre Rios','Sud América 1145','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(126,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(127,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(128,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(129,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(130,14,'Tucuman','Lavalle 2646','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(131,14,'Azul','1123','2025-09-22 13:19:17','2025-09-22 13:26:27','2025-09-22 13:26:27'),
(132,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(133,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(134,14,'Entre Rios','Sud América 1145','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(135,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(136,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(137,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(138,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(139,14,'Tucuman','Lavalle 2646','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(140,14,'Azul','1123','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(141,14,'Resistencia','Av Belgrano 2384','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(142,14,'Posadas','1','2025-09-22 13:26:27','2025-09-22 13:43:13','2025-09-22 13:43:13'),
(143,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(144,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(145,14,'Entre Rios','Sud América 1145','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(146,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(147,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(148,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(149,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(150,14,'Tucuman','Lavalle 2646','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(151,14,'Azul','1123','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(152,14,'Resistencia','Av Belgrano 2384','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(153,14,'Posadas','1','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(154,14,'Corrientes','123','2025-09-22 13:43:13','2025-09-22 13:43:45','2025-09-22 13:43:45'),
(155,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(156,14,'Cordoda','Av. Cincumbalacion','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(157,14,'Entre Rios','Sud América 1145','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(158,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(159,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(160,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(161,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(162,14,'Tucuman','Lavalle 2646','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(163,14,'Azul','1123','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(164,14,'Resistencia','Av Belgrano 2384','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(165,14,'Posadas','1','2025-09-22 13:43:45','2025-09-22 14:19:45','2025-09-22 14:19:45'),
(166,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 14:19:45','2025-09-22 14:47:41','2025-09-22 14:47:41'),
(167,14,'Cordoda','Av. Cincumbalacion','2025-09-22 14:19:45','2025-09-22 14:47:41','2025-09-22 14:47:41'),
(168,14,'Entre Rios','Sud América 1145','2025-09-22 14:19:45','2025-09-22 14:47:41','2025-09-22 14:47:41'),
(169,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 14:19:45','2025-09-22 14:47:42','2025-09-22 14:47:42'),
(170,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 14:19:45','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(171,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 14:19:45','2025-09-22 14:47:42','2025-09-22 14:47:42'),
(172,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 14:19:45','2025-09-22 14:47:42','2025-09-22 14:47:42'),
(173,14,'Tucuman','Lavalle 2646','2025-09-22 14:19:45','2025-09-22 14:47:43','2025-09-22 14:47:43'),
(174,14,'Azul','1123','2025-09-22 14:19:45','2025-09-22 14:47:43','2025-09-22 14:47:43'),
(175,14,'Resistencia','Av Belgrano 2384','2025-09-22 14:19:45','2025-09-22 14:47:43','2025-09-22 14:47:43'),
(176,14,'Posadas','1','2025-09-22 14:19:45','2025-09-22 14:47:44','2025-09-22 14:47:44'),
(177,14,'PRUEBA NO TOCAR','NO TOCAR','2025-09-22 14:19:45','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(178,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 14:47:38','2025-09-22 14:49:05','2025-09-22 14:49:05'),
(179,14,'Cordoda','Av. Cincumbalacion','2025-09-22 14:47:38','2025-09-22 14:49:05','2025-09-22 14:49:05'),
(180,14,'Entre Rios','Sud América 1145','2025-09-22 14:47:39','2025-09-22 14:49:06','2025-09-22 14:49:06'),
(181,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 14:47:39','2025-09-22 14:49:06','2025-09-22 14:49:06'),
(182,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 14:47:39','2025-09-22 14:49:06','2025-09-22 14:49:06'),
(183,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 14:47:39','2025-09-22 14:49:07','2025-09-22 14:49:07'),
(184,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 14:47:39','2025-09-22 14:49:07','2025-09-22 14:49:07'),
(185,14,'Tucuman','Lavalle 2646','2025-09-22 14:47:39','2025-09-22 14:49:07','2025-09-22 14:49:07'),
(186,14,'Azul','1123','2025-09-22 14:47:40','2025-09-22 14:49:08','2025-09-22 14:49:08'),
(187,14,'Resistencia','Av Belgrano 2384','2025-09-22 14:47:40','2025-09-22 14:49:08','2025-09-22 14:49:08'),
(188,14,'Posadas','1','2025-09-22 14:47:40','2025-09-22 14:49:08','2025-09-22 14:49:08'),
(189,14,'PRUEBA NO TOCAR','NO TOCAR','2025-09-22 14:47:40','2025-09-22 14:49:09','2025-09-22 14:49:09'),
(190,14,'NO TOCAR 2','NOOOO','2025-09-22 14:47:40','2025-09-22 14:49:09','2025-09-22 14:49:09'),
(191,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 14:49:01','2025-09-22 15:20:21','2025-09-22 15:20:21'),
(192,14,'PRUEBA NO TOCAR','NO TOCAR','2025-09-22 14:49:02','2025-09-22 15:20:21','2025-09-22 15:20:21'),
(193,14,'Bahia Blanca','Don Bosco 2695','2025-09-22 14:49:02','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(194,14,'Cordoda','Av. Cincumbalacion','2025-09-22 14:49:02','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(195,14,'Entre Rios','Sud América 1145','2025-09-22 14:49:02','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(196,14,'Formosa','Córdoba 211, cp: 3600','2025-09-22 14:49:02','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(197,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-22 14:49:02','2025-09-22 15:20:21','2025-09-22 15:20:21'),
(198,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-22 14:49:03','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(199,14,'Santa Fe','Santa Fe coronel bogado','2025-09-22 14:49:03','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(200,14,'Tucuman','Lavalle 2646','2025-09-22 14:49:03','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(201,14,'Azul','1123','2025-09-22 14:49:03','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(202,14,'Resistencia','Av Belgrano 2384','2025-09-22 14:49:03','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(203,14,'Posadas','1','2025-09-22 14:49:03','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(204,14,'PRUEBA NO TOCAR','NO TOCAR','2025-09-22 14:49:04','2025-09-22 15:20:21','2025-09-22 15:20:21'),
(205,14,'NO TOCAR 2','NOOOO','2025-09-22 14:49:04','2025-09-22 15:20:21','2025-09-22 15:20:21'),
(206,14,'NO TOCAR 3','NOO','2025-09-22 14:49:04','2025-09-22 15:20:21','2025-09-22 15:20:21'),
(207,14,'NO TOCAS PROFAVOR ULTIMA PRUEBA','N otocar','2025-09-22 15:21:11','2025-09-23 11:34:03','2025-09-23 11:34:03'),
(208,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(209,14,'PRUEBA NO TOCAR','NO TOCAR','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(210,14,'Bahia Blanca','Don Bosco 2695','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(211,14,'Cordoda','Av. Cincumbalacion','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(212,14,'Entre Rios','Sud América 1145','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(213,14,'Formosa','Córdoba 211, cp: 3600','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(214,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(215,14,'Santa Fe','Santa Fe coronel bogado','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(216,14,'Tucuman','Lavalle 2646','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(217,14,'Azul','1123','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(218,14,'Resistencia','Av Belgrano 2384','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(219,14,'Posadas','1','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(220,14,'NO TOCAS PROFAVOR ULTIMA PRUEBA','N otocar','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(221,14,'Corrientes','123','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(222,14,'Rosario','21654','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(223,14,'Tortuguitas','258','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(224,14,'Parana','147','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(225,14,'Rio Cuarto','3669','2025-09-23 11:34:03','2025-09-23 12:45:42','2025-09-23 12:45:42'),
(226,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(227,14,'PRUEBA NO TOCAR','NO TOCAR','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(228,14,'Bahia Blanca','Don Bosco 2695','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(229,14,'Cordoda','Av. Cincumbalacion','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(230,14,'Entre Rios','Sud América 1145','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(231,14,'Formosa','Córdoba 211, cp: 3600','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(232,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(233,14,'Santa Fe','Santa Fe coronel bogado','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(234,14,'Tucuman','Lavalle 2646','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(235,14,'Azul','1123','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(236,14,'Resistencia','Av Belgrano 2384','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(237,14,'Posadas','1','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(238,14,'NO TOCAS PROFAVOR ULTIMA PRUEBA','N otocar','2025-09-23 12:45:42','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(239,14,'Corrientes','123','2025-09-23 12:45:43','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(240,14,'Rosario','21654','2025-09-23 12:45:43','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(241,14,'Tortuguitas','258','2025-09-23 12:45:43','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(242,14,'Parana','147','2025-09-23 12:45:43','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(243,14,'Rio Cuarto','3669','2025-09-23 12:45:43','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(244,14,'Rafaela','258','2025-09-23 12:45:43','2025-09-23 13:44:31','2025-09-23 13:44:31'),
(245,14,'Mendoza','Ruta Nacional 40, Acceso Sur Km 14 5507 Luján de Cuyo Mendoza','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(246,14,'Bahia Blanca','Don Bosco 2695','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(247,14,'Cordoda','Av. Cincumbalacion','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(248,14,'Entre Rios','Sud América 1145','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(249,14,'Formosa','Córdoba 211, cp: 3600','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(250,14,'San Juan','Mendoza 396 Rawson, frente a la empresa Mayo','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(251,14,'Santa Fe','Santa Fe coronel bogado','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(252,14,'Tucuman','Lavalle 2646','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(253,14,'Azul','1123','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(254,14,'Resistencia','Av Belgrano 2384','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(255,14,'Posadas','1','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(256,14,'Corrientes','123','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(257,14,'Rosario','21654','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(258,14,'Tortuguitas','258','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(259,14,'Parana','147','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(260,14,'Rio Cuarto','3669','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(261,14,'Rafaela','258','2025-09-23 13:44:31','2025-09-23 13:44:31',NULL),
(262,14,'no tocar porfavor','no es una sucursa','2025-09-23 13:44:31','2025-09-23 13:53:03','2025-09-23 13:53:03'),
(263,14,'1111','11111','2025-09-23 13:52:00','2025-09-23 13:53:03','2025-09-23 13:53:03'),
(264,14,'San Luis','1','2025-09-25 11:49:32','2025-09-25 11:49:32',NULL),
(265,14,'Santa Rosa','1','2025-09-25 12:17:46','2025-09-25 12:17:46',NULL),
(266,14,'Tortuguitas','1','2025-09-25 12:17:46','2025-09-25 12:17:46',NULL),
(269,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-09-25 18:58:29','2025-09-25 18:58:29',NULL),
(270,15,'Musilandia','Musipan calle moscu','2025-09-29 02:26:17','2025-09-29 02:26:17',NULL),
(271,3,'AMBA','1234','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(272,3,'Bahia Blanca','123654','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(273,3,'Concepcion','231564','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(274,3,'Cordoba','2146','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(275,3,'Resistencia','12564','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(276,3,'Tres Arroyo','5647','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(277,3,'Tucuman','2345','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(278,3,'Santa Fe','35465','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(279,3,'Venado Tuerto','654','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(280,3,'Hurlingham','321687','2025-09-30 11:42:21','2025-09-30 11:42:21',NULL),
(281,3,'Rosario','32154','2025-09-30 15:19:43','2025-09-30 15:19:43',NULL),
(282,14,'Mar del Plata','132','2025-10-01 12:09:40','2025-10-01 12:09:40',NULL),
(283,16,'Don Torcuato','112','2025-10-01 14:33:58','2025-10-01 14:33:58',NULL),
(287,13,'Resistencia','321315','2025-10-02 12:51:52','2025-10-02 12:51:52',NULL),
(288,17,'Taoi','Tapi','2025-10-04 02:53:00','2025-10-04 02:53:00',NULL),
(289,16,'sevem','sevm','2025-10-04 02:53:22','2025-10-04 02:53:22',NULL),
(290,17,'estaciñon calle grande','estaciñon calle grande','2025-10-04 11:07:01','2025-10-04 11:07:01',NULL),
(291,17,'barrio nuevo','bn','2025-10-04 11:07:01','2025-10-04 11:07:01',NULL),
(292,14,'mexico','juan v pampin','2025-10-10 19:46:24','2025-10-10 19:46:32','2025-10-10 19:46:32'),
(293,14,'yacare','1234','2025-10-13 12:02:24','2025-10-13 12:02:32','2025-10-13 12:02:32'),
(297,13,'jhghjg','jkhkjn','2025-10-13 12:36:28','2025-10-13 12:37:55','2025-10-13 12:37:55'),
(301,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-10-13 12:54:43','2025-10-13 12:55:34','2025-10-13 12:55:34'),
(302,13,'gghfgh','fghfgh','2025-10-13 12:54:43','2025-10-13 12:59:27','2025-10-13 12:59:27'),
(303,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-10-13 12:55:34','2025-10-13 12:58:12','2025-10-13 12:58:12'),
(304,13,'fghfghg','fghfgh','2025-10-13 12:55:34','2025-10-13 12:59:27','2025-10-13 12:59:27'),
(305,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-10-13 12:58:12','2025-10-13 12:58:51','2025-10-13 12:58:51'),
(306,13,'Rosario','1234','2025-10-13 12:58:12','2025-10-13 12:58:12',NULL),
(307,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-10-13 12:58:51','2025-10-13 12:59:27','2025-10-13 12:59:27'),
(308,13,'Corboba','1324','2025-10-13 12:58:51','2025-10-13 12:58:51',NULL),
(309,13,'Corrientes','1324','2025-10-13 12:58:51','2025-10-13 12:58:51',NULL),
(310,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-10-13 12:59:27','2025-10-13 13:09:26','2025-10-13 13:09:26'),
(311,13,'Formosa','ESPAÑA Nº 2304  España 2304, P3600HLJ Formosa','2025-10-13 13:09:26','2025-10-13 13:09:26',NULL),
(312,13,'Avellaneda','1234','2025-10-13 13:09:26','2025-10-13 13:09:26',NULL),
(313,13,'Sarandi','145','2025-10-13 13:09:26','2025-10-13 13:09:26',NULL),
(314,13,'Bahia Blanca','1456','2025-10-13 13:09:26','2025-10-13 13:09:26',NULL),
(315,13,'Neuquen','1545','2025-10-13 13:09:26','2025-10-13 13:09:26',NULL);
/*!40000 ALTER TABLE `sucursals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transporte_temporals`
--

DROP TABLE IF EXISTS `transporte_temporals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `transporte_temporals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` bigint(20) unsigned NOT NULL,
  `guia_remito` text DEFAULT NULL,
  `valor_viaje` decimal(12,2) DEFAULT NULL,
  `origen` text DEFAULT NULL,
  `destino` text DEFAULT NULL,
  `estado_servicio_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transporte_temporals_persona_id_foreign` (`persona_id`),
  CONSTRAINT `transporte_temporals_persona_id_foreign` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transporte_temporals`
--

LOCK TABLES `transporte_temporals` WRITE;
/*!40000 ALTER TABLE `transporte_temporals` DISABLE KEYS */;
/*!40000 ALTER TABLE `transporte_temporals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `unidades`
--

DROP TABLE IF EXISTS `unidades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `unidades` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `matricula` text DEFAULT NULL,
  `marca` text DEFAULT NULL,
  `modelo` text DEFAULT NULL,
  `anio` text DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `unidades`
--

LOCK TABLES `unidades` WRITE;
/*!40000 ALTER TABLE `unidades` DISABLE KEYS */;
INSERT INTO `unidades` VALUES
(1,'Chico (Fiorino, Kangoo, Cubo, Eetc)','Chico (Fiorino, Kangoo, Cubo, etc)','1.6','2025',NULL,'2025-09-15 14:58:54','2025-09-22 14:06:59',NULL),
(2,'Mediano (Master, Ducato,etc)','Mediano (Master, Ducato, etc)','2.0','2025',NULL,'2025-09-15 14:59:04','2025-09-22 14:09:03',NULL),
(3,'Grande (Accelo 815, Mercedez 710, etc)','Grande (Accelo 815, Mercedez 710, etc)','3.0','2025',NULL,'2025-09-18 13:53:28','2025-09-30 11:33:33',NULL),
(4,'Moto','Moto','2025','2025',NULL,'2025-09-23 11:40:27','2025-09-23 11:40:27',NULL),
(5,'xpt299','TOYOTA','COROLLA','2015','carro de paseo','2025-09-29 02:27:23','2025-09-30 11:33:20','2025-09-30 11:33:20'),
(6,'Auto','Auto','DDD','2025',NULL,'2025-10-01 13:38:09','2025-10-01 13:38:09',NULL),
(7,'12312','FIAT','TORO','2017','No tiene paragolpes','2025-10-04 02:31:01','2025-10-04 02:31:20','2025-10-04 02:31:20'),
(8,'21654','nave espacial','212156','65468',NULL,'2025-10-10 19:45:39','2025-10-10 19:45:53','2025-10-10 19:45:53');
/*!40000 ALTER TABLE `unidades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'Super Admin','personal@logisticaargentinasrl.com.ar',NULL,'$2y$12$CBQyR1PitZqb4mtCeyGtOu/0eVxCqAQu8UffOYl7MweaC9ZeGq8e6',NULL,'2025-09-15 08:54:15','2025-09-15 08:54:15'),
(2,'Monica Fernandez','monica@logisticaargentinasrl.com.ar',NULL,'$2y$12$GxANIznkBXAdqP62Drq98.8.mVLBKLh.5WcPBzOPzmRSWHN5OG9Z2',NULL,'2025-09-15 14:57:30','2025-10-09 17:11:33'),
(3,'Joel Romero','joel@logisticaargentinasrl.com.ar',NULL,'$2y$12$a8VjsE.ufG9/zr4EuqVECOYWEWSgb7sOIMYztwhqMstIoYjoGyFO2',NULL,'2025-09-15 14:58:24','2025-09-15 14:58:24'),
(4,'Dario Gonzalez','dgonzalez@logisticaargentinasrl.com.ar',NULL,'$2y$12$gfJTzF/WPDfPI3Hw5kw6e.JXIrQs8nbWliVApIjRQh/ZlqDcQxkEG',NULL,'2025-09-15 15:49:36','2025-10-09 17:11:46'),
(5,'Leando Martinez','lmartinez@logisticaargentinasrl.com.ar',NULL,'$2y$12$hDEojchTblCYXOdyx2Uvo.Gcbju6N1OT1nF9Fgv1T3bD/y8E63k4C',NULL,'2025-09-16 15:26:28','2025-09-16 15:26:28'),
(6,'Administador Cruz Negra','admin@cruznegra.com',NULL,'$2y$12$vadrmpqxhjOHfiQb3TTfVel2wfCGHWwHyJpQoRLp0RQRUadL9pVSm',NULL,'2025-09-16 16:52:28','2025-10-16 02:26:58'),
(7,'Cecilia Frowein','ceciliaf@logisticaargentinasrl.com.ar',NULL,'$2y$12$IVaRvvZinSdMvpTYp34DtewwxRfqFgV4mmuGEjxGgA6QEI2sl5qvu',NULL,'2025-09-17 12:39:55','2025-09-17 12:39:55'),
(8,'Gerardo Aguirre','gerardoa@logisticaargentinasrl.com.ar',NULL,'$2y$12$Q/Idcx9arjZQFdSUsecqK..mqn4ZpW.CbIpXH3yKdtvT3QzhirOzO',NULL,'2025-09-17 12:41:17','2025-09-17 12:41:17'),
(9,'Ezequiel Bordon','ezequielb@logisticaargentinasrl.com.ar',NULL,'$2y$12$H8hs0P9blwvIgWmeXlsm5uyk.vee.VEh0HOS6VoR15OMNd2OmqJQ6',NULL,'2025-09-19 14:56:44','2025-09-19 14:56:44'),
(11,'LA','la@logisticaargentinasrl.com.ar',NULL,'$2y$12$bS4X5Hkm75gt6AuvBzgIqOhgtIhGWYtuJN1CuLUT8eteCmXpLOR82',NULL,'2025-09-22 12:35:19','2025-09-22 12:35:19'),
(12,'Joaquin Castillo','joaquinc@logisticaargentinasrl.com.ar',NULL,'$2y$12$I2MPjzfs8WjqZw1RLKhsYOkWUjfFB9UVarNaQRrDNcq6oRAuUAQpy',NULL,'2025-09-22 19:59:18','2025-10-09 17:11:57'),
(15,'Sebastian Cabrera','scabrera@logisticaargentinasrl.com.ar',NULL,'$2y$12$RQT9srl6Fl0MO2aR3283uOGZmwTdH9lKC676Szvtk3M9FT7neKjdW',NULL,'2025-09-23 15:06:58','2025-09-23 15:06:58'),
(18,'Ariel Lopez','ariellopez@logisticaargentinasrl.com.ar',NULL,'$2y$12$wiiLuBf9r3p1ay8SIfrj2.YIJqAWuv5A1hy1bmI/BvAWQ0FJrXSLC',NULL,'2025-09-24 17:38:36','2025-10-09 17:12:25'),
(19,'Santino Cerezo','santino@logisticaargentinasrl.com.ar',NULL,'$2y$12$hkpHeYWbJ1t9Pgr9YynxfOe9O0nu.9bQlXnp7XOgyH/M7aWF3w3Fi',NULL,'2025-09-25 17:56:31','2025-09-25 17:56:31'),
(20,'Yasmin Roy Nacer','yasminr@logisticaargentinasrl.com.ar',NULL,'$2y$12$YPJ62Ug7jBtw78nI/pc1bOw.NPBL8vLyOJrpMMDdOYsXZFgFOiBdK',NULL,'2025-09-25 18:13:06','2025-09-25 18:13:06'),
(22,'David Gimenez','dgimenez@logisticaargentinasrl.com.ar',NULL,'$2y$12$QZc9Zhw5g.aOFNhO4ajXDe/e3MSnYLwjq0UV4NUwA6./XJQItd4SG',NULL,'2025-10-01 18:48:30','2025-10-01 18:48:30'),
(23,'Gabriela Lozada','glozada@initiumsoft.com',NULL,'$2y$12$VGARU.7kCL4Ln6BTI.1VOuzobp8wvcd8OabPQHa7N/UmZ97MxwH.y',NULL,'2025-10-04 02:55:13','2025-10-04 02:55:13');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-16  9:34:23
