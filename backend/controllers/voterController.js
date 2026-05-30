const supabase = require('../config/supabaseClient');

/**
 * Controller: Search voter records inside Supabase DB.
 * Supports fuzzy matching on name, and filters on village, NID, father's name, district, upazila, voter_area.
 */
exports.searchVoters = async (req, res, next) => {
  try {
    const { name, fatherName, village, nid, district, upazila, voterArea } = req.query;

    let query = supabase.from('voters').select('*');

    if (name) {
      query = query.or(`name_bn.ilike.%${name}%,name_en.ilike.%${name}%`);
    }
    if (fatherName) {
      query = query.ilike('father_name', `%${fatherName}%`);
    }
    if (village) {
      query = query.ilike('village', `%${village}%`);
    }
    if (nid) {
      query = query.eq('nid', nid);
    }
    if (district) {
      query = query.ilike('district', `%${district}%`);
    }
    if (upazila) {
      query = query.ilike('upazila', `%${upazila}%`);
    }
    if (voterArea) {
      query = query.ilike('voter_area', `%${voterArea}%`);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      results: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Register / Add single voter record.
 */
exports.createVoter = async (req, res, next) => {
  try {
    const {
      nid, voterNo, nameBn, nameEn, fatherName, motherName, dob,
      village, gender, bloodGroup, pageNumber,
      serialNo, occupation, unionName, wardNo, voterArea, voterAreaNo,
      upazila, district, postCode, publicationDate, pdfUploadId
    } = req.body;

    if (!nameBn) {
      const err = new Error('Bengali Name is required.');
      err.status = 400;
      throw err;
    }

    const { data, error } = await supabase
      .from('voters')
      .insert([{
        nid,
        voter_no: voterNo,
        name_bn: nameBn,
        name_en: nameEn,
        father_name: fatherName,
        mother_name: motherName,
        dob,
        village,
        gender,
        blood_group: bloodGroup,
        page_number: pageNumber,
        serial_no: serialNo,
        occupation,
        union_name: unionName,
        ward_no: wardNo,
        voter_area: voterArea,
        voter_area_no: voterAreaNo,
        upazila,
        district,
        post_code: postCode,
        publication_date: publicationDate,
        pdf_upload_id: pdfUploadId,
        status: 'সক্রিয়'
      }])
      .select();

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return res.status(201).json({
      success: true,
      message: 'Voter data recorded successfully!',
      voter: data[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Bulk import voters (from CSV paste in admin panel)
 */
exports.bulkImportVoters = async (req, res, next) => {
  try {
    const { voters, pdfUploadId } = req.body;

    if (!voters || !Array.isArray(voters) || voters.length === 0) {
      const err = new Error('Voters array is required and must not be empty.');
      err.status = 400;
      throw err;
    }

    // Map frontend fields to DB columns
    const rows = voters.map(v => ({
      nid: v.nid || null,
      voter_no: v.voterNo || v.voter_no || null,
      name_bn: v.nameBn || v.name_bn,
      name_en: v.nameEn || v.name_en || null,
      father_name: v.fatherName || v.father_name || null,
      mother_name: v.motherName || v.mother_name || null,
      dob: v.dob || null,
      village: v.village || null,
      gender: v.gender || null,
      blood_group: v.bloodGroup || v.blood_group || null,
      occupation: v.occupation || null,
      serial_no: v.serialNo || v.serial_no || null,
      union_name: v.unionName || v.union_name || null,
      ward_no: v.wardNo || v.ward_no || null,
      voter_area: v.voterArea || v.voter_area || null,
      voter_area_no: v.voterAreaNo || v.voter_area_no || null,
      upazila: v.upazila || null,
      district: v.district || null,
      post_code: v.postCode || v.post_code || null,
      publication_date: v.publicationDate || v.publication_date || null,
      pdf_upload_id: pdfUploadId || null,
      status: 'সক্রিয়'
    }));

    const { data, error } = await supabase
      .from('voters')
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Supabase bulk insert failed: ${error.message}`);
    }

    // Update voter_count in pdf_uploads
    if (pdfUploadId) {
      await supabase
        .from('pdf_uploads')
        .update({ voter_count: data.length })
        .eq('id', pdfUploadId);
    }

    return res.status(201).json({
      success: true,
      message: `${data.length} voters imported successfully!`,
      count: data.length,
      voters: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Delete a voter
 */
exports.deleteVoter = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('voters')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Voter deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Delete voters by pdfUploadId
 */
exports.deleteVotersByPdf = async (req, res, next) => {
  try {
    const { pdfUploadId } = req.params;

    const { data, error } = await supabase
      .from('voters')
      .delete()
      .eq('pdf_upload_id', pdfUploadId)
      .select();

    if (error) {
      throw new Error(`Supabase delete by pdf failed: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      message: `${data.length} voters deleted.`,
      count: data.length
    });
  } catch (err) {
    next(err);
  }
};
