const { Op } = require("sequelize");
const { User, Department, Internship, Application, Evaluation, Establishment, Student } = require("../models/models");

exports.getDashboard = async (req, res) => {
  try {
    const chief = await User.findOne({
      where: { id: req.user.id },
      include: [
        { model: Department, as: "department" },
        { model: Establishment, as: "establishment" },
      ],
    });

    if (!chief) {
      return res.status(404).render("error", {
        error: "Profil chef de service non trouvé",
        user: req.user,
      });
    }

    // Get internships supervised by this chief
    const internships = await Internship.findAll({
      where: { departmentId: chief.departmentId, establishmentId: chief.establishmentId },
    });

    const internshipIds = internships.map(i => i.id);

    // Statistics
    const stats = {
      pendingApplications: await Application.count({
        where: { internshipId: { [Op.in]: internshipIds }, status: "En attente" },
      }),
      activeInternships: await Internship.count({
        where: { id: { [Op.in]: internshipIds }, status: "Actif" },
      }),
      pendingEvaluations: await Evaluation.count({
        where: { internshipId: { [Op.in]: internshipIds }, status: "Soumise" },
      }),
      totalStudents: await Application.count({
        where: { internshipId: { [Op.in]: internshipIds }, status: "Acceptée" },
      }),
    };

    // Urgent applications (pending > 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const urgentApplications = await Application.findAll({
      where: { internshipId: { [Op.in]: internshipIds }, status: "En attente", appliedDate: { [Op.lte]: sevenDaysAgo } },
      include: [Student, Internship],
      limit: 5,
      order: [["appliedDate", "ASC"]],
    });

    // Active internships with details
    const activeInternships = await Internship.findAll({
      where: { id: { [Op.in]: internshipIds }, status: "Actif" },
      include: [{ model: Department }, { model: Establishment }],
    });

    // Pending evaluations
    const pendingEvaluations = await Evaluation.findAll({
      where: { internshipId: { [Op.in]: internshipIds }, status: "Soumise" },
      include: [Student, Internship, { model: User, as: "doctor" }],
      limit: 5,
      order: [["submissionDate", "DESC"]],
    });

    res.render("service-chief/dashboard", {
      chief,
      stats,
      urgentApplications,
      activeInternships,
      pendingEvaluations,
      title: "Tableau de Bord Chef de Service",
    });
  } catch (error) {
    console.error("Chief dashboard error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement du tableau de bord",
      user: req.user,
    });
  }
};

exports.getInternships = async (req, res) => {
  try {
    const chief = await User.findOne({ where: { id: req.user.id } });
    const internships = await Internship.findAll({
      where: { departmentId: chief.departmentId, establishmentId: chief.establishmentId },
      include: [{ model: Department }, { model: Establishment }],
      order: [["createdAt", "DESC"]],
    });

    res.render("service-chief/internships", {
      internships,
      title: "Gestion des Stages",
    });
  } catch (error) {
    console.error("Internships error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement des stages",
      user: req.user,
    });
  }
};

exports.createInternship = async (req, res) => {
  try {
    const chief = await User.findOne({ where: { id: req.user.id } });

    const departments = await Department.findAll({ where: { isActive: true } });
    const establishments = await Establishment.findAll({ where: { isActive: true } });

    res.render("service-chief/create-internship", {
      departments,
      establishments,
      chief,
      title: "Créer un Stage",
    });
  } catch (error) {
    console.error("Create internship form error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement du formulaire",
      user: req.user,
    });
  }
};

exports.storeInternship = async (req, res) => {
  try {
    const chief = await User.findOne({ where: { id: req.user.id } });
    const { title, description, departmentId, establishmentId, duration, startDate, endDate, totalPlaces, requirements } = req.body;

    await Internship.create({
      title,
      description,
      departmentId,
      establishmentId,
      chiefId: chief.id,
      duration,
      startDate,
      endDate,
      totalPlaces: parseInt(totalPlaces),
      filledPlaces: 0,
      requirements: requirements ? JSON.stringify(requirements.split(",").map(r => r.trim())) : null,
      status: "Actif",
    });

    res.redirect("/service-chief/internships");
  } catch (error) {
    console.error("Store internship error:", error);
    res.status(500).render("error", {
      error: "Erreur lors de la création du stage",
      user: req.user,
    });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const chief = await User.findOne({ where: { id: req.user.id } });
    const { status, internshipId } = req.query;

    const internships = await Internship.findAll({ where: { chiefId: chief.id } });
    const internshipIds = internships.map(i => i.id);

    const filter = { internshipId: { [Op.in]: internshipIds } };
    if (status) filter.status = status;
    if (internshipId) filter.internshipId = internshipId;

    const applications = await Application.findAll({
      where: filter,
      include: [Student, Internship, { model: User, as: "processedBy" }],
      order: [["appliedDate", "DESC"]],
    });

    const stats = {
      pending: await Application.count({ where: { ...filter, status: "En attente" } }),
      accepted: await Application.count({ where: { ...filter, status: "Acceptée" } }),
      rejected: await Application.count({ where: { ...filter, status: "Refusée" } }),
    };

    res.render("service-chief/applications", {
      applications,
      stats,
      filters: { status, internshipId },
      title: "Gestion des Candidatures",
    });
  } catch (error) {
    console.error("Applications error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement des candidatures",
      user: req.user,
    });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const chief = await User.findOne({ where: { id: req.user.id } });

    const application = await Application.findOne({
      where: { id },
      include: [{ model: Internship, where: { chiefId: chief.id } }],
    });

    if (!application) {
      return res.status(404).json({ success: false, error: "Candidature non trouvée" });
    }

    application.status = status;
    application.processedById = chief.id;
    if (status === "Refusée" && rejectionReason) application.rejectionReason = rejectionReason;

    await application.save();

    // Update filledPlaces if accepted
    if (status === "Acceptée") {
      const internship = await Internship.findByPk(application.internshipId);
      internship.filledPlaces += 1;
      await internship.save();
    }

    res.json({ success: true, message: "Statut mis à jour avec succès" });
  } catch (error) {
    console.error("Update application status error:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour" });
  }
};

exports.getEvaluations = async (req, res) => {
  try {
    const chief = await User.findOne({ where: { id: req.user.id } });
    const { status } = req.query;

    const internships = await Internship.findAll({ where: { chiefId: chief.id } });
    const internshipIds = internships.map(i => i.id);

    const filter = { internshipId: { [Op.in]: internshipIds } };
    if (status) filter.status = status;

    const evaluations = await Evaluation.findAll({
      where: filter,
      include: [Student, Internship, { model: User, as: "doctor" }],
      order: [["submissionDate", "DESC"]],
    });

    res.render("service-chief/evaluations", {
      evaluations,
      filters: { status },
      title: "Évaluations des Stages",
    });
  } catch (error) {
    console.error("Evaluations error:", error);
    res.status(500).render("error", {
      error: "Erreur lors du chargement des évaluations",
      user: req.user,
    });
  }
};

exports.validateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { chiefComments } = req.body;
    const chief = await User.findOne({ where: { id: req.user.id } });

    const evaluation = await Evaluation.findOne({
      where: { id, status: "Soumise" },
      include: [{ model: Internship, where: { chiefId: chief.id } }],
    });

    if (!evaluation) {
      return res.status(404).json({ success: false, error: "Évaluation non trouvée" });
    }

    evaluation.chiefValidation = true;
    evaluation.chiefComments = chiefComments;
    evaluation.status = "Clôturée";
    await evaluation.save();

    res.json({ success: true, message: "Évaluation validée avec succès" });
  } catch (error) {
    console.error("Validate evaluation error:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la validation" });
  }
};
