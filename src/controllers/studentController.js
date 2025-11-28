const { Op } = require("sequelize");
const { User, Student, Internship, Application, Evaluation, Department, Establishment, Doctor, ServiceChief, Document } = require("../models/models");

// Helper to get student by user ID
const getStudentByUserId = async (userId) => {
  return await Student.findOne({ where: { userId } });
};

// Dashboard
exports.getDashboard = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(200).json({
        status: "success",
        message: "Admin access OK (no student dashboard available)."
      });
    }
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ status: "error", message: "Profil étudiant non trouvé" });

    const applications = await Application.findAll({
      where: { studentId: student.id },
      include: [Internship],
      order: [["appliedDate", "DESC"]],
      limit: 5
    });

    const stats = {
      pending: await Application.count({ where: { studentId: student.id, status: "pending" } }),
      accepted: await Application.count({ where: { studentId: student.id, status: "accepted" } }),
      rejected: await Application.count({ where: { studentId: student.id, status: "rejected" } }),
      total: await Application.count({ where: { studentId: student.id } })
    };

    const recommendedInternships = await Internship.findAll({
      where: { isActive: true, isPublished: true, startDate: { [Op.gte]: new Date() } },
      include: [Department, Establishment, ServiceChief],
      limit: 3,
      order: [["startDate", "ASC"]]
    });

    res.status(200).json({ status: "success", data: { student, applications, stats, recommendedInternships } });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors du chargement du tableau de bord" });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    res.status(200).json({ status: "success", data: { student } });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors du chargement du profil" });
  }
};

// Update Profile + Upload Document
exports.updateProfile = async (req, res) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ status: "error", message: "Profil étudiant non trouvé" });

    const { firstName, lastName, level, phone } = req.body;
    student.firstName = firstName;
    student.lastName = lastName;
    student.level = level;
    student.phone = phone;
    await student.save();

    // Handle uploaded document
    if (req.file) {
      await Document.create({
        studentId: student.id,
        name: req.body.documentName || "Document",
        filePath: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        fileSize: req.file.size
      });
    }

    res.status(200).json({ status: "success", data: { student } });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors de la mise à jour du profil" });
  }
};

// Other endpoints: getInternships, getInternshipDetails, applyToInternship, getApplications, cancelApplication, getEvaluations
// ... Keep your previous code for these, they are fine

exports.getInternships = async (req, res) => {
  try {
    const { departmentId, establishmentId, search, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true, isPublished: true, startDate: { [Op.gte]: new Date() } };

    if (departmentId) filter.departmentId = departmentId;
    if (establishmentId) filter.establishmentId = establishmentId;
    if (search) {
      filter[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const internships = await Internship.findAll({
      where: filter,
      include: [Department, Establishment, ServiceChief],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    const total = await Internship.count({ where: filter });

    res.status(200).json({
      status: "success",
      data: {
        internships,
        pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error("Internships error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors du chargement des stages" });
  }
};

exports.getInternshipDetails = async (req, res) => {
  try {
    const internship = await Internship.findByPk(req.params.id, {
      include: [Department, Establishment, ServiceChief],
    });

    if (!internship) return res.status(404).json({ status: "error", message: "Stage non trouvé" });

    const student = await getStudentByUserId(req.user.id);
    const existingApplication = await Application.findOne({
      where: { studentId: student.id, internshipId: internship.id },
    });

    res.status(200).json({ status: "success", data: { internship, hasApplied: !!existingApplication } });
  } catch (error) {
    console.error("Internship details error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors du chargement du stage" });
  }
};

exports.applyToInternship = async (req, res) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    const { id } = req.params;

    if (!student.profileCompleted) return res.status(400).json({ status: "error", message: "Veuillez compléter votre profil avant de postuler" });

    const existingApplication = await Application.findOne({ where: { studentId: student.id, internshipId: id } });
    if (existingApplication) return res.status(400).json({ status: "error", message: "Vous avez déjà postulé à ce stage" });

    const internship = await Internship.findByPk(id);
    if (!internship || !internship.isActive || internship.availablePlaces <= 0) {
      return res.status(400).json({ status: "error", message: "Ce stage n'est plus disponible" });
    }

    const application = await Application.create({ studentId: student.id, internshipId: id, status: "pending" });

    res.status(201).json({ status: "success", data: { application } });
  } catch (error) {
    console.error("Apply error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors de la candidature" });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { studentId: student.id };
    if (status) filter.status = status;

    const applications = await Application.findAll({
      where: filter,
      include: [Internship, { model: User, as: "processedBy" }],
      order: [["appliedDate", "DESC"]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    const total = await Application.count({ where: filter });

    res.status(200).json({ status: "success", data: { applications, pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total } } });
  } catch (error) {
    console.error("Applications error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors du chargement des candidatures" });
  }
};

exports.cancelApplication = async (req, res) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    const { id } = req.params;

    const application = await Application.findOne({ where: { id, studentId: student.id, status: "pending" } });
    if (!application) return res.status(404).json({ status: "error", message: "Candidature non trouvée ou ne peut pas être annulée" });

    application.status = "cancelled";
    await application.save();

    res.status(200).json({ status: "success", message: "Candidature annulée avec succès" });
  } catch (error) {
    console.error("Cancel application error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors de l'annulation" });
  }
};

exports.getEvaluations = async (req, res) => {
  try {
    const student = await getStudentByUserId(req.user.id);

    const evaluations = await Evaluation.findAll({
      where: { studentId: student.id },
      include: [Internship, { model: User, as: "doctor" }, { model: User, as: "chief" }],
      order: [["submittedAt", "DESC"]],
    });

    res.status(200).json({ status: "success", data: { evaluations } });
  } catch (error) {
    console.error("Evaluations error:", error);
    res.status(500).json({ status: "error", message: "Erreur lors du chargement des évaluations" });
  }
};
