"""SQLAlchemy ORM models placeholder for the MedVault Hepatology OCR pipeline."""

from sqlalchemy import Column, Integer, Float, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    emergency_phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    filetype = Column(String, nullable=True)
    shared_at = Column(String, nullable=True)
    status = Column(String, default="processing")
    ocr_text = Column(Text, nullable=True)
    doc_type = Column(String, nullable=True)
    ocr_engine = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    analyzed = Column(Integer, default=0)
    classification = Column(String, nullable=True)
    structured_results = Column(Text, nullable=True)
    analysis = Column(Text, nullable=True)
    llm_analysis = Column(Text, nullable=True)
    llm_engine = Column(String, nullable=True)
    llm_duration = Column(Float, nullable=True)

