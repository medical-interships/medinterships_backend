const { Op } = require("sequelize")
const { Internship, Department, Establishment, User, Application } = require("../models/models")
const NotificationService = require("../service/notificationService")
const { socketEvents } = require("../socket/events")
const { getIO } = require("../socket/socket")

exports.createInternship = async (req, res) => {
  try {
    const { title, description, departmentId, establishmentId, totalPlaces, startDate, endDate, requirements } =
      req.body

    const internship = await Internship.create({
      title,
      description,
      departmentId,
      establishmentId,
      totalPlaces,
      startDate,
      endDate,
      requirements,
      status: "actif",
      createdBy: req.user.id,
    })

    const io = getIO()
    io.to("role-student").emit(socketEvents.INTERNSHIP_CREATED, {
      id: internship.id,
      title: internship.title,
      description: internship.description,
      totalPlaces: internship.totalPlaces,
      startDate: internship.startDate,
    })

    await NotificationService.sendToRole("student", {
      type: "info",
      title: "Nouveau stage disponible",
      message: `Un nouveau stage "${title}" a été créé et est maintenant disponible`,
      relatedEntityType: "Internship",
      relatedEntityId: internship.id,
    })

    res.status(201).json({ status: "success", data: { internship } })
  } catch (error) {
    console.error("Create internship error:", error)
    res.status(500).json({ status: "error", message: "Erreur lors de la création du stage" })
  }
}

exports.updateInternship = async (req, res) => {
  try {
    const { id } = req.params
    const { status, totalPlaces, filledPlaces } = req.body

    const internship = await Internship.findByPk(id)
    if (!internship) {
      return res.status(404).json({ status: "error", message: "Stage non trouvé" })
    }

    if (status) internship.status = status
    if (totalPlaces) internship.totalPlaces = totalPlaces
    if (filledPlaces !== undefined) internship.filledPlaces = filledPlaces

    await internship.save()

    const io = getIO()
    io.to("role-student").emit(socketEvents.INTERNSHIP_UPDATED, {
      id: internship.id,
      status: internship.status,
      totalPlaces: internship.totalPlaces,
      filledPlaces: internship.filledPlaces,
    })

    if (status === "complet") {
      await NotificationService.sendToRole("student", {
        type: "warning",
        title: "Stage complet",
        message: `Le stage "${internship.title}" est maintenant complet`,
        relatedEntityType: "Internship",
        relatedEntityId: internship.id,
      })
    } else if (status === "cloture") {
      await NotificationService.sendToRole("student", {
        type: "warning",
        title: "Stage fermé",
        message: `Le stage "${internship.title}" a été fermé`,
        relatedEntityType: "Internship",
        relatedEntityId: internship.id,
      })
    }

    res.status(200).json({ status: "success", data: { internship } })
  } catch (error) {
    console.error("Update internship error:", error)
    res.status(500).json({ status: "error", message: "Erreur lors de la mise à jour" })
  }
}

exports.getPublicInternships = async (req, res) => {
  try {
    const { service, establishment, search, page = 1, limit = 10 } = req.query

    const filter = {
      isActive: true,
      isPublished: true,
    }

    if (service) filter.service = service
    if (establishment) filter.establishment = establishment

    if (search) {
      filter.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }

    const internships = await Internship.find(filter)
      .populate("service")
      .populate("establishment")
      .populate("chief")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit)

    const total = await Internship.countDocuments(filter)

    res.status(200).json({
      status: "success",
      data: {
        internships,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    console.error("Public internships error:", error)
    res.status(500).json({
      status: "error",
      message: "Erreur lors du chargement des stages",
    })
  }
}

exports.getInternshipDetails = async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id)
      .populate("service")
      .populate("establishment")
      .populate("chief")

    if (!internship) {
      return res.status(404).json({
        status: "error",
        message: "Stage non trouvé",
      })
    }

    res.status(200).json({
      status: "success",
      data: { internship },
    })
  } catch (error) {
    console.error("Internship details error:", error)
    res.status(500).json({
      status: "error",
      message: "Erreur lors du chargement du stage",
    })
  }
}
