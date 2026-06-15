import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export const dummyStaffData = [
  { name: 'ABHILASH M G', dept: 'Sales & Marketing', shift: 'Shop Shift', status: 'Present', in: '07:08', out: '19:05', ot: '00:05', phone: '9876543210' },
  { name: 'CINTO THATTIL', dept: 'Sales & Marketing', shift: '', status: 'Paid Leave', in: '-', out: '-', ot: '00:00', phone: '9876543211' },
  { name: 'LIJO K A', dept: 'Transportation(driver)', shift: 'Shop Shift', status: 'Pending', in: '09:07', out: '19:34', ot: '00:00', phone: '9876543212' },
  { name: 'MURALI P D', dept: 'Sales & Marketing', shift: 'Shop Shift', status: 'Present', in: '09:17', out: '19:02', ot: '00:02', phone: '9876543213' },
  { name: 'NANDAKUMAR MENON', dept: 'Debt Recovery', shift: '', status: 'Absent', in: '-', out: '-', ot: '00:00', phone: '9876543214' },
  { name: 'PRADEEP A K', dept: 'Hr & Admin', shift: 'Office Shift', status: 'Present', in: '09:27', out: '19:04', ot: '00:34', phone: '9876543215' },
  { name: 'PRASANTH T M', dept: 'Sales & Marketing', shift: 'Office Shift', status: 'Pending', in: '09:31', out: '18:31', ot: '00:01', phone: '9876543216' },
  { name: 'RAJIV C S', dept: 'Group G.m', shift: 'Office Shift', status: 'Present', in: '09:32', out: '19:56', ot: '01:26', phone: '9876543217' },
  { name: 'SIJO GEORGE', dept: 'Transportation(driver)', shift: 'Shop Shift', status: 'Pending', in: '10:24', out: '19:01', ot: '00:00', phone: '9876543218' },
];

export const seedDatabaseIfEmpty = async () => {
  try {
    const staffCollection = collection(db, "staff");
    const snapshot = await getDocs(staffCollection);
    
    if (snapshot.empty) {
      console.log("Database is empty. Seeding initial staff data...");
      for (const staff of dummyStaffData) {
        await addDoc(staffCollection, staff);
      }
      console.log("Database seeded successfully!");
    } else {
      console.log("Database already has data. Skipping seed.");
    }
  } catch (error) {
    console.error("Error seeding database: ", error);
  }
};
