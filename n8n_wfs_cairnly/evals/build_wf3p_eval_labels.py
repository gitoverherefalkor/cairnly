import json
P="Paid work, part time or per project"; I="Interim or freelance work in my field"; B="A board, supervisory or advisory role"
M="Mentoring or coaching"; T="Teaching or training"; V="Volunteering"; S="Starting something small of my own"
def L(rows): return {t:{"forms":f,"family":fam,"pay":p,**({"eur_hour":e} if e is not None else {})} for t,f,fam,p,e in rows}
henk=L([
("Interim Warehouse Process Specialist",[I,P],"operations consulting","fair",112),
("WMS Implementation Support Consultant",[I,P],"system go-live support","fair",122),
("Part-time Logistics Planner",[P],"planning","fair",34),
("Forklift Instructor",[T,P],"training","fair",50),
("Management Consultant (Independent)",[I,S,P],"operations consulting","fair",147),
("Production Planner",[P],"planning","fair",32),
("Facilities Coordinator",[P],"facilities coordination","fair",25),
("Hospital Logistics Coordinator",[P],"logistics coordination","fair",28),
("Work Supervisor",[P],"supervising","fair",23),
("Event Operations Coordinator",[P,I],"event operations","fair",47),
("Safety Coordinator",[P],"safety","fair",34),
("Workplace Mentor",[M,P],"mentoring","fair",105),
("Training Provider",[S,T],"training","fair",24),
("Property Maintenance Coordinator",[P],"facilities coordination","fair",24),
("Workshop Facilitator",[T,P],"training","fair",26)])
marjan=L([
("Language Buddy (Volunteer)",[V,T],"language tutoring","none",None),
("Reading Buddy (Volunteer)",[V,T],"reading with children","none",None),
("Storytime Volunteer",[V],"reading with children","none",None),
("Adult Literacy Tutor",[T,P],"language tutoring","fair",None),
("Homework Club Mentor",[V,M],"tutoring children","none",None),
("Home-Start Volunteer",[V],"family support","none",None),
("Youth Mentor",[V,M],"youth mentoring","none",None),
("Digital Skills Coach (Volunteer)",[V,T],"digital skills teaching","none",None),
("Guest Lecturer",[T,P],"lecturing","fair",None),
("Remedial Teacher",[T,P],"tutoring children","fair",None),
("Student Mentor",[M,P],"mentoring trainees","fair",None),
("BookStart Coach",[T,P],"reading with children","fair",None),
("Museum Education Volunteer",[V],"guiding groups","none",None),
("Nature Education Volunteer",[V],"guiding groups","none",None),
("Hospice Volunteer",[V],"care companionship","none",None)])
peter=L([
("Tax Advisory Consultant",[I],"tax advice","fair",None),
("Family Business Adviser",[I,B],"business advice","fair",None),
("Interim Finance Adviser",[I],"finance advice","fair",None),
("Supervisory Board Member",[B],"board oversight","low",None),
("Mentor",[M],"mentoring","fair",None),
("Advisory Board Member",[B],"board oversight","fair",None),
("Business Coach",[M],"mentoring","fair",None),
("Investment Committee Member",[B],"board oversight","fair",None),
("Nonprofit Finance Adviser",[I],"finance advice","fair",None),
("Guest Lecturer",[T],"lecturing","fair",None),
("Expert Witness",[I],"expert testimony","fair",None),
("Business Mediator",[I],"mediation","fair",None),
("Columnist",[P],"writing","fair",None),
("Case Writer",[P],"writing","fair",None),
("PUM Netherlands Expert",[V,B],"business advice","none",None)])
margaret=L([
("Patient Safety Partner",[P,V],"patient involvement","low",None),
("Nursing OSCE Assessor",[P],"assessing nurses","fair",None),
("Simulation Patient",[P],"role-play for training","fair",None),
("Patient Representative",[V,B],"patient involvement","low",None),
("Charity Trustee",[B,V],"board oversight","none",None),
("Carers Support Group Volunteer Facilitator",[V],"support groups","none",None),
("Bereavement Support Volunteer",[V],"emotional support","none",None),
("Hospice Companion Volunteer",[V],"companionship","none",None),
("Dementia Activity Group Volunteer",[V],"activity groups","none",None),
("Community Transport Escort",[V],"escorting","none",None),
("Witness Service Volunteer",[V],"emotional support","none",None),
("Community Cafe Volunteer",[V],"hospitality","none",None),
("Independent Visitor",[V,M],"befriending","none",None),
("Refugee Befriender",[V],"befriending","none",None),
("Exam Invigilator",[P],"invigilating","low",None)])
rows=[
 {"persona":"Henk","report_id":"a410169b-49a2-460d-a1d8-93d69960c3cd","source_run":"round 5 (2026-11-13)","labels":json.dumps(henk),"active":True},
 {"persona":"Marjan","report_id":"206f5fe0-3285-47c3-b1fd-88be29b9b2d4","source_run":"round 5 (2026-11-13)","labels":json.dumps(marjan),"active":True},
 {"persona":"Peter","report_id":"5dde13c9-8dad-4f7d-b16f-123dbd352fa0","source_run":"round 4 (2026-11-13)","labels":json.dumps(peter),"active":True},
 {"persona":"Margaret","report_id":"2669b7ec-37a2-4092-a0f4-b70f4c3c5744","source_run":"round 1 (2026-11-11, older WF2P)","labels":json.dumps(margaret),"active":True}]
json.dump(rows,open('rows.json','w'),ensure_ascii=False)
print(max(len(r['labels']) for r in rows))
