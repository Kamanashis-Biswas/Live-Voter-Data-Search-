const supabase = require('../config/supabaseClient');

/**
 * Controller: Search voter records inside Supabase DB.
 * Supports fuzzy matching on name, and filters on village (গ্রাম), NID, and father's name.
 */
exports.searchVoters = async (req, res, next) => {
  try {
    const { name, fatherName, village, nid } = req.query;

    // Start a query on the "voters" table
    let query = supabase.from('voters').select('*');

    // Dynamically build filter constraints
    if (name) {
      // Fuzzy match name or name_en
      query = query.or(`name_bn.ilike.%${name}%,name_en.ilike.%${name}%`);
    }
    if (fatherName) {
      query = query.ilike('father_name', `%${fatherName}%`);
    }
    if (village) {
      query = query.eq('village', village);
    }
    if (nid) {
      query = query.eq('nid', nid);
    }

    const { data, error } = await query;

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
 * Controller: Register / Add voter record.
 */
exports.createVoter = async (req, res, next) => {
  try {
    const { nid, voterNo, nameBn, nameEn, fatherName, motherName, dob, village, gender, bloodGroup, pageNumber } = req.body;

    if (!nid || !nameBn || !village) {
      const err = new Error('NID, Bengali Name, and Village are required fields.');
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
        status: 'সক্রিয়'
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
