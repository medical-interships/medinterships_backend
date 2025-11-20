
const { DataTypes } = require("sequelize");
const sequelize = require("./config");
const { v4: uuidv4 } = require("uuid");


const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM("student", "chief", "doctor", "admin"),
    allowNull: false,
  },
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  phone: DataTypes.STRING,
  profilePhoto: DataTypes.STRING,
  establishmentId: { type: DataTypes.UUID, allowNull: true },
  departmentId: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastLogin: DataTypes.DATE,
});


const Student = sequelize.define("Student", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  phone: DataTypes.STRING,
  level: {
    type: DataTypes.ENUM("2ème année", "3ème année", "4ème année", "5ème année", "6ème année"),
  },
  specialty: DataTypes.STRING,
  profilePhoto: DataTypes.STRING,
  registrationDate: DataTypes.DATE,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});


const Establishment = sequelize.define("Establishment", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  address: DataTypes.STRING,
  phone: DataTypes.STRING,
  email: DataTypes.STRING,
  website: DataTypes.STRING,
  type: {
    type: DataTypes.ENUM("CHU", "Clinique", "Hôpital", "Polyclinique"),
  },
  departments: DataTypes.INTEGER,
  totalStudents: DataTypes.INTEGER,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});



const Department = sequelize.define("Department", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  establishmentId: DataTypes.UUID,
  chiefId: DataTypes.UUID,
  totalPlaces: DataTypes.INTEGER,
  availablePlaces: DataTypes.INTEGER,
});




const Internship = sequelize.define("Internship", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  departmentId: DataTypes.UUID,
  establishmentId: DataTypes.UUID,
  totalPlaces: { type: DataTypes.INTEGER, allowNull: false },
  filledPlaces: { type: DataTypes.INTEGER, defaultValue: 0 },
  duration: DataTypes.STRING,
  startDate: DataTypes.DATE,
  endDate: DataTypes.DATE,
  requirements: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM("Actif", "Complet", "Archivé", "Clôturé"),
    defaultValue: "Actif",
  },
  createdBy: DataTypes.UUID,
});


const Application = sequelize.define("Application", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  studentId: DataTypes.UUID,
  internshipId: DataTypes.UUID,
  status: {
    type: DataTypes.ENUM("En attente", "Acceptée", "Refusée", "Annulée"),
    defaultValue: "En attente",
  },
  appliedDate: DataTypes.DATE,
  startDate: DataTypes.DATE,
  departmentTitle: DataTypes.STRING,
  hospital: DataTypes.STRING,
  motivationLetter: DataTypes.TEXT,
  cv: DataTypes.STRING,
  responseDate: DataTypes.DATE,
  rejectionReason: DataTypes.TEXT,
});


const Evaluation = sequelize.define("Evaluation", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  studentId: DataTypes.UUID,
  internshipId: DataTypes.UUID,
  doctorId: DataTypes.UUID,
  status: {
    type: DataTypes.ENUM("En attente", "En cours", "Soumise"),
    defaultValue: "En attente",
  },
  startDate: DataTypes.DATE,
  dueDate: DataTypes.DATE,
  submissionDate: DataTypes.DATE,
  score: DataTypes.INTEGER,
  comments: DataTypes.TEXT,
  evaluationForm: DataTypes.JSON,
});


const Document = sequelize.define("Document", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  studentId: DataTypes.UUID,
  name: DataTypes.STRING,
  fileUrl: DataTypes.STRING,
  fileSize: DataTypes.INTEGER,
  mimeType: DataTypes.STRING,
  uploadedDate: DataTypes.DATE,
});



const Notification = sequelize.define("Notification", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  userId: DataTypes.UUID,
  type: {
    type: DataTypes.ENUM("success", "warning", "error", "info"),
  },
  title: DataTypes.STRING,
  message: { type: DataTypes.STRING, allowNull: false },
  relatedEntityType: DataTypes.STRING,
  relatedEntityId: DataTypes.UUID,
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: DataTypes.DATE,
});




const Admin = sequelize.define("Admin", {
  id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true,
  },
  userId: DataTypes.UUID,
  permissions: DataTypes.JSON,
});



Student.hasMany(Application, { foreignKey: "studentId" });
Application.belongsTo(Student);

Student.hasMany(Evaluation, { foreignKey: "studentId" });
Evaluation.belongsTo(Student);

Student.hasMany(Document, { foreignKey: "studentId" });
Document.belongsTo(Student);


Establishment.hasMany(Department, { foreignKey: "establishmentId" });
Department.belongsTo(Establishment);


Establishment.hasMany(Internship, { foreignKey: "establishmentId" });
Internship.belongsTo(Establishment);


Department.hasMany(Internship, { foreignKey: "departmentId" });
Internship.belongsTo(Department);

Internship.hasMany(Application, { foreignKey: "internshipId" });
Application.belongsTo(Internship);

Internship.hasMany(Evaluation, { foreignKey: "internshipId" });
Evaluation.belongsTo(Internship);


User.belongsTo(Establishment, { foreignKey: "establishmentId" });
User.belongsTo(Department, { foreignKey: "departmentId" });

User.hasMany(Evaluation, { foreignKey: "doctorId" });
Evaluation.belongsTo(User, { foreignKey: "doctorId" });


User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User);


Admin.belongsTo(User, { foreignKey: "userId" });


module.exports = {
  sequelize,
  User,
  Student,
  Establishment,
  Department,
  Internship,
  Application,
  Evaluation,
  Document,
  Notification,
  Admin,
};
