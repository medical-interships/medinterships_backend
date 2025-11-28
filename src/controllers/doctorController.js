const { Op } = require("sequelize");
const { User, Doctor, Student, Evaluation, Application, Internship, Department, Establishment } = require("../models/models");

exports.getDashboard = async (req, res) => {
  try {
    // Find the doctor linked to the logged-in user
    const doctor = await User.findOne({
      where: { id: req.user.id },
      include: [
        { model: Department, as: "department" },
        { model: Establishment, as: "establishment" },
      ],
    });

    if (!doctor) {
      return res.status(404).render("error", {
        error: "Profil médecin non trouvé",
        user: req.user,
      });
    }

    // Get students (all students supervised by this doctor via evaluations or internships)
    const supervisedStudents = await Student.findAll({
      include: [
        {
          model: Evaluation,
          where: { doctorId: doctor.id },
          required: false, // include even if no evaluations yet
        },
      ],
    });

    // Get pending evaluations (draft)
    const pendingEvaluations = await Evaluation.findAll({
      where: { doctorId: doctor.id, status: "En attente" },
      include: [Student, Internship],
      limit: 5,
    });

    // Get submitted evaluations
    const completedEvaluations = await Evaluation.findAll({
      where: { doctorId: doctor.id, status: "Soumise" },
      include: [Student, Internship],
    });

    res.render("doctor/dashboard", {
      doctor,
      supervisedStudents,
      pendingEvaluations,
      completedEvaluations,
      title: "Tableau de Bord Médecin Superviseur",
    });
  } catch (error) {
    console.error("Doctor dashboard error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement du tableau de bord",
      user: req.user,
    });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const doctor = await User.findOne({ where: { id: req.user.id } });

    // Find internships supervised by this doctor
    const internships = await Internship.findAll({
      where: { departmentId: doctor.departmentId, establishmentId: doctor.establishmentId },
    });

    const internshipIds = internships.map(i => i.id);

    // Get accepted applications for these internships
    const applications = await Application.findAll({
      where: { internshipId: { [Op.in]: internshipIds }, status: "Acceptée" },
      include: [Student, Internship],
      order: [["appliedDate", "DESC"]],
    });

    res.render("doctor/students", {
      students: applications.map(app => ({
        student: app.Student,
        internship: app.Internship,
        application: app,
      })),
      title: "Étudiants Supervisés",
    });
  } catch (error) {
    console.error("Students error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement des étudiants",
      user: req.user,
    });
  }
};

exports.getStudentDetails = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);

    if (!student) {
      return res.status(404).render("error", {
        error: "Étudiant non trouvé",
        user: req.user,
      });
    }

    // Current accepted internship
    const application = await Application.findOne({
      where: { studentId: student.id, status: "Acceptée" },
      include: [Internship],
    });

    res.render("doctor/student-details", {
      student,
      internship: application ? application.Internship : null,
      title: `Profil de ${student.firstName} ${student.lastName}`,
    });
  } catch (error) {
    console.error("Student details error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement du profil étudiant",
      user: req.user,
    });
  }
};

exports.getEvaluations = async (req, res) => {
  try {
    const doctor = await User.findOne({ where: { id: req.user.id } });
    const { status } = req.query;

    const filter = { doctorId: doctor.id };
    if (status) filter.status = status;

    const evaluations = await Evaluation.findAll({
      where: filter,
      include: [Student, Internship],
      order: [["submissionDate", "DESC"]],
    });

    res.render("doctor/evaluations", {
      evaluations,
      filters: { status },
      title: "Mes Évaluations",
    });
  } catch (error) {
    console.error("Evaluations error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement des évaluations",
      user: req.user,
    });
  }
};

exports.createEvaluation = async (req, res) => {
  try {
    const doctor = await User.findOne({ where: { id: req.user.id } });
    const { applicationId } = req.params;

    const application = await Application.findByPk(applicationId, {
      include: [Student, Internship],
    });

    if (!application || application.status !== "Acceptée") {
      return res.status(404).render("error", {
        error: "Candidature non trouvée ou non acceptée",
        user: req.user,
      });
    }

    // Check if evaluation already exists
    let evaluation = await Evaluation.findOne({
      where: { studentId: application.studentId, internshipId: application.internshipId, doctorId: doctor.id },
    });

    if (!evaluation) {
      evaluation = await Evaluation.create({
        studentId: application.studentId,
        internshipId: application.internshipId,
        doctorId: doctor.id,
        status: "En attente",
      });
    }

    res.render("doctor/evaluation-form", {
      evaluation,
      student: application.Student,
      internship: application.Internship,
      title: "Évaluation de Stage",
    });
  } catch (error) {
    console.error("Create evaluation error:", error);
    res.status(500).render("error", {
      error: "Erreur lors de la création de l'évaluation",
      user: req.user,
    });
  }
};

exports.submitEvaluation = async (req, res) => {
  try {
    const doctor = await User.findOne({ where: { id: req.user.id } });
    const { id } = req.params;
    const { attendance, practicalSkills, professionalBehavior, doctorComments } = req.body;

    const evaluation = await Evaluation.findOne({
      where: { id, doctorId: doctor.id },
    });

    if (!evaluation) {
      return res.status(404).json({ success: false, error: "Évaluation non trouvée" });
    }

    evaluation.attendance = parseFloat(attendance);
    evaluation.practicalSkills = parseFloat(practicalSkills);
    evaluation.professionalBehavior = parseFloat(professionalBehavior);
    evaluation.comments = doctorComments;
    evaluation.status = "Soumise";

    await evaluation.save();

    res.json({ success: true, message: "Évaluation soumise avec succès" });
  } catch (error) {
    console.error("Submit evaluation error:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la soumission de l'évaluation" });
  }
};
