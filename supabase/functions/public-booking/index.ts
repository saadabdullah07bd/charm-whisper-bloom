import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Validate required fields
    const { name, age, gender } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!age || typeof age !== "number" || age < 0 || age > 150) {
      return new Response(
        JSON.stringify({ error: "Valid age is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!gender || !["male", "female", "other"].includes(gender)) {
      return new Response(
        JSON.stringify({ error: "Valid gender is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate appointment fields
    const appointmentDate = body.appointment_date;
    const timeSlot = body.time_slot;
    if (!appointmentDate || !timeSlot) {
      return new Response(
        JSON.stringify({ error: "Appointment date and time slot are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate time slot
    const validSlots = ["9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM"];
    if (!validSlots.includes(timeSlot)) {
      return new Response(
        JSON.stringify({ error: "Invalid time slot" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

     const parseSlotDateTime = (date: string, time: string) => {
       const match = String(time).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
       if (!match) return null;
       let hours = parseInt(match[1], 10);
       const minutes = parseInt(match[2], 10);
       const meridiem = match[3].toUpperCase();
       if (meridiem === 'PM' && hours !== 12) hours += 12;
       if (meridiem === 'AM' && hours === 12) hours = 0;
       const value = new Date(`${date}T00:00:00`);
       value.setHours(hours, minutes, 0, 0);
       return value;
     };

     // Validate date is within next 12 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(appointmentDate + "T00:00:00");
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 12);
    if (selectedDate < today || selectedDate > maxDate) {
      return new Response(
        JSON.stringify({ error: "Date must be within the next 12 days" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const slotDateTime = parseSlotDateTime(appointmentDate, timeSlot);
    if (!slotDateTime || slotDateTime.getTime() - Date.now() < 4 * 60 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Appointments must be booked at least 4 hours in advance" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if slot is already booked
    const { data: existingSlot } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", appointmentDate)
      .eq("time_slot", timeSlot)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();

    if (existingSlot) {
      return new Response(
        JSON.stringify({ error: "This time slot is already booked" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if same phone number already booked on same day
    const phone = body.phone?.trim()?.slice(0, 20) || null;
    if (phone) {
      const { data: existingPhone } = await supabase
        .from("appointments")
        .select("id")
        .eq("appointment_date", appointmentDate)
        .eq("patient_phone", phone)
        .in("status", ["pending", "confirmed"])
        .maybeSingle();

      if (existingPhone) {
        return new Response(
          JSON.stringify({ error: "You already have a booking on this date. Only one appointment per day is allowed." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if email is provided and find existing user
    const email = body.email?.trim()?.toLowerCase();
    let userId: string | null = null;

    if (email) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const existingUser = userData?.users?.find(
        (u: any) => u.email?.toLowerCase() === email
      );
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    // Build patient record
    const patient: Record<string, any> = {
      name: name.trim().slice(0, 255),
      age: Math.floor(age),
      gender,
      marital_status: body.maritalStatus || body.marital_status || "single",
      address: body.address?.trim()?.slice(0, 500) || null,
      phone: phone,
      occupation: body.occupation?.trim()?.slice(0, 100) || null,
      weight: body.weight ? Number(body.weight) : null,
      height_feet: body.heightFeet ? Number(body.heightFeet) : (body.height_feet ? Number(body.height_feet) : null),
      height_inches: body.heightInches ? Number(body.heightInches) : (body.height_inches ? Number(body.height_inches) : null),
      height_cm: body.heightCm ? Number(body.heightCm) : (body.height_cm ? Number(body.height_cm) : null),
      chief_complaint: (body.chiefComplaint || body.chief_complaint)?.trim()?.slice(0, 1000) || null,
      history_of_present_illness: body.history_of_present_illness?.trim()?.slice(0, 2000) || null,
      physical_activity: body.physical_activity || null,
      medical_conditions: Array.isArray(body.medical_conditions) ? body.medical_conditions.map((s: string) => String(s).slice(0, 200)) : [],
      allergies: Array.isArray(body.allergies) ? body.allergies.map((s: string) => String(s).slice(0, 200)) : [],
      past_illness_history: body.past_illness_history?.trim()?.slice(0, 2000) || null,
      treatment_history: body.treatment_history?.trim()?.slice(0, 2000) || null,
      personal_history: body.personal_history?.trim()?.slice(0, 2000) || null,
      immunization_history: body.immunization_history?.trim()?.slice(0, 2000) || null,
      drug_history: body.drug_history?.trim()?.slice(0, 2000) || null,
      socio_economic_status: body.socio_economic_status?.trim()?.slice(0, 200) || null,
      pregnancy_status: body.pregnancy_status || null,
      previous_childbirths: body.previous_childbirths ? Number(body.previous_childbirths) : null,
      ob_gyn_history: body.ob_gyn_history?.trim()?.slice(0, 2000) || null,
      profile_locked: true,
    };

    if (userId) {
      patient.user_id = userId;
    }

    // Upsert patient (find by phone if exists)
    let patientId: string;
    if (phone) {
      const { data: existingPatient } = await supabase
        .from("patients")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingPatient) {
        patientId = existingPatient.id;
        // Update existing patient
        await supabase.from("patients").update(patient).eq("id", patientId);
      } else {
        const { data, error } = await supabase.from("patients").insert(patient).select("id").single();
        if (error) {
          console.error("Insert error:", error.message);
          return new Response(
            JSON.stringify({ error: "Failed to save patient data" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        patientId = data.id;
      }
    } else {
      const { data, error } = await supabase.from("patients").insert(patient).select("id").single();
      if (error) {
        console.error("Insert error:", error.message);
        return new Response(
          JSON.stringify({ error: "Failed to save patient data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      patientId = data.id;
    }

    // Create appointment
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        patient_name: name.trim().slice(0, 255),
        patient_phone: phone,
        
        appointment_date: appointmentDate,
        time_slot: timeSlot,
        chief_complaint: (body.chiefComplaint || body.chief_complaint)?.trim()?.slice(0, 1000) || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (aptError) {
      console.error("Appointment insert error:", aptError.message);
      // If it's a unique constraint violation
      if (aptError.code === '23505') {
        return new Response(
          JSON.stringify({ error: "This time slot is already booked" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to create appointment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notifications removed

    return new Response(
      JSON.stringify({ success: true, id: patientId, appointment_id: appointment.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
