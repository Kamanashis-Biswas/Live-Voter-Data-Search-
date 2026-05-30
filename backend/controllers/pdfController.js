const supabase = require('../config/supabaseClient');

/**
 * Controller: Save PDF upload metadata (cover page info)
 */
exports.createPdfUpload = async (req, res, next) => {
  try {
    const {
      fileName, fileSize,
      district, upazila, unionName, wardNo,
      voterArea, voterAreaNo, totalVoters, totalFemaleVoters,
      genderType, publicationDate, postCode, integrityHash
    } = req.body;

    if (!fileName || !district || !upazila) {
      const err = new Error('File name, district, and upazila are required.');
      err.status = 400;
      throw err;
    }

    const { data, error } = await supabase
      .from('pdf_uploads')
      .insert([{
        file_name: fileName,
        file_size: fileSize,
        district,
        upazila,
        union_name: unionName,
        ward_no: wardNo,
        voter_area: voterArea,
        voter_area_no: voterAreaNo,
        total_voters: totalVoters ? parseInt(totalVoters) : null,
        total_female_voters: totalFemaleVoters ? parseInt(totalFemaleVoters) : null,
        gender_type: genderType,
        publication_date: publicationDate,
        post_code: postCode,
        integrity_hash: integrityHash,
        voter_count: 0,
        status: 'সফল'
      }])
      .select();

    if (error) {
      throw new Error(`Supabase PDF upload failed: ${error.message}`);
    }

    return res.status(201).json({
      success: true,
      message: 'PDF metadata saved successfully!',
      pdf: data[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Get all PDF uploads list
 */
exports.getPdfList = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('pdf_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase PDF list failed: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      pdfs: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Update PDF voter_count
 */
exports.updatePdfVoterCount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { voterCount } = req.body;

    const { data, error } = await supabase
      .from('pdf_uploads')
      .update({ voter_count: voterCount })
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }

    return res.status(200).json({ success: true, pdf: data[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Delete PDF upload metadata
 */
exports.deletePdfUpload = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('pdf_uploads')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Supabase PDF delete failed: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'PDF record deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};
