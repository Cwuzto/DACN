const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { computeCanonicalPayloadHash } = require('../../src/services/electronicSignatureService');
const { DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS } = require('../../src/services/rubricService');
const { buildAccounts, getSemesterDefinitions } = require('./demoFixtures');
const { buildStudentProfileData } = require('./phase1Fixtures');

const RUBRIC_VERSION = DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.version;
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

/**
 * 10 Đề tài và 3 mốc tiến độ thực tế (24/8, 21/9, 19/10) do người dùng cung cấp
 */
const TEN_STUDENTS_TOPICS = [
  {
    studentIndex: 1, // sv001
    mentorIndex: 0,  // lecturer01 (TS. Nguyễn Văn Thắng)
    title: 'Xây dựng hệ thống học tập trực tuyến tích hợp mô hình ngôn ngữ lớn (LLM) và thực thi mã nguồn tự động',
    description: 'Hệ thống e-learning tích hợp AI phân tích tài liệu, hỏi đáp thông minh và môi trường runcode tự động đánh giá bài tập lập trình.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Mới hoàn thiện màn hình đăng nhập, tài liệu video hết hạn nên chưa tải được nội dung bài học. Đã thiết kế chức năng Admin cơ bản (quản lý thông tin sinh viên, giáo viên).',
        remainingIssues: 'Chưa quản lý được lớp học do giáo viên tạo, chưa có ngân hàng câu hỏi và cơ chế tải bài tập lên khóa học.',
        nextTasks: 'Hoàn thiện chức năng quản lý lớp học cho giáo viên; đưa bài tập lên khóa học để sinh viên làm; tích hợp LLM phân tích tài liệu.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Nghiên cứu AI & Hệ thống Thông tin - P.B301',
        studentCompletedWork: 'Đã tích hợp mô hình ngôn ngữ lớn (LLM) phân tích nội dung tài liệu và trả lời câu hỏi trong khóa học. Tích hợp tính năng bài tập runcode, lưu đánh giá kết quả làm bài của sinh viên.',
        remainingIssues: 'Giao diện khóa học chưa phân định rõ vai trò (GV làm được gì, SV làm được gì). Các chức năng chưa liên kết liền mạch vào luồng e-learning.',
        nextTasks: 'Định nghĩa rõ luồng nghiệp vụ khóa học tương tự e-learning; hỗ trợ giáo viên chấm điểm tổng thể và cá nhân; phân tích bài tập làm sai; bổ sung sao lưu, phục hồi khóa.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Cấu trúc khóa học hoàn chỉnh tương tự e-learning; tích hợp hỗ trợ GV chấm điểm tổng thể và cá nhân; SV chạy runcode và hệ thống tự động phân tích bài tập sai; xếp loại sinh viên; bổ sung tính năng sao lưu và phục hồi khóa học.',
        remainingIssues: 'Cần tối ưu thời gian phản hồi khi gọi LLM và đóng gói tài liệu kỹ thuật.',
        nextTasks: 'Hoàn thiện báo cáo đồ án tốt nghiệp, chuẩn bị đánh giá BM04 và bảo vệ trước Hội đồng.',
        progressRating: 'ON_TRACK',
      },
    ],
    isReadyForEvaluation: true,
    evaluationStatus: 'DRAFT',
  },
  {
    studentIndex: 2, // sv002
    mentorIndex: 0,  // lecturer01 (TS. Nguyễn Văn Thắng)
    title: 'Ứng dụng thị giác máy tính và học sâu trong nhận diện vật thể phục vụ học từ vựng tiếng Anh tương tác',
    description: 'Ứng dụng học tiếng Anh qua camera quét nhận diện vật thể thực tế, trích xuất từ vựng, luyện tập 3D, Quiz và đấu trường tương tác.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Đã huấn luyện xong mô hình học sâu cơ bản; ứng dụng thành công vào nhận diện vật thể thời gian thực và hiển thị từ vựng tiếng Anh tương ứng. Các chức năng quét cơ bản đã hoàn thành.',
        remainingIssues: 'Mô hình chưa tự động học được khi phát hiện vật thể mới. Cần nghiên cứu kiến trúc YOLO hiện đại hơn để nâng cao độ chính xác.',
        nextTasks: 'Nghiên cứu mô hình chạy ngầm trích xuất đặc trưng hình ảnh để admin duyệt vào CSDL; xây dựng tính năng camera quét lưu từ vựng vào bộ sưu tập cá nhân.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Nghiên cứu AI & Hệ thống Thông tin - P.B301',
        studentCompletedWork: 'Triển khai mô hình chạy ngầm nhặt đặc trưng hình ảnh đẩy vào admin duyệt CSDL. Xây dựng tài khoản sinh viên: quét camera nhận diện từ vựng, lưu bộ sưu tập, luyện tập qua 3D và Quiz.',
        remainingIssues: 'Chưa phân loại từ vựng trong Quiz theo chủ đề; chưa chuyển được từ vựng từ bộ sưu tập cá nhân lên quảng trường công cộng để người khác xem.',
        nextTasks: 'Tối ưu phân loại từ vựng Quiz; hoàn thiện chia sẻ bộ sưu tập lên quảng trường; xây dựng module đánh giá người học, đấu trường thi đấu và bảng xếp hạng.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Hoàn thiện Camera quét hình trích xuất đặc trưng (YOLOv8, YOLO-World), lưu bộ sưu tập riêng; phát triển đấu trường chung có bảng xếp hạng; trích xuất văn bản từ tài liệu sinh từ vựng; quản lý lớp học và cấp chứng nhận hoàn thành.',
        remainingIssues: 'Cần tối ưu bộ nhớ khi chạy camera trên thiết bị di động.',
        nextTasks: 'Đóng gói ứng dụng, hoàn thiện tài liệu thuyết minh và chuẩn bị đánh giá BM04.',
        progressRating: 'ON_TRACK',
      },
    ],
    isReadyForEvaluation: true,
    evaluationStatus: 'DRAFT',
  },
  {
    studentIndex: 3, // sv003
    mentorIndex: 0,  // lecturer01 (TS. Nguyễn Văn Thắng)
    title: 'Xây dựng hệ thống giám sát và cảnh báo an toàn lao động tại công trường xây dựng bằng thị giác máy tính',
    description: 'Hệ thống giám sát camera thông minh phát hiện vi phạm an toàn lao động (mũ, áo, khu vực nguy hiểm) và phân tích rủi ro tại công trường.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Thử nghiệm mô hình YOLO11 trên tập dữ liệu Kaggle; bước đầu nhận diện được đối tượng công nhân (điều kiện cần).',
        remainingIssues: 'Mô hình mới chỉ nhận diện người, chưa phát hiện trang thiết bị bảo hộ (mũ, áo bảo hộ, dây đai) và các yếu tố nguy hiểm ngoại cảnh.',
        nextTasks: 'Thu thập thêm dữ liệu hình ảnh thực tế tại công trường xây dựng; huấn luyện model tổng quát phát hiện đồng thời người và đồ bảo hộ; tích hợp cảnh báo.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Nghiên cứu AI & Hệ thống Thông tin - P.B301',
        studentCompletedWork: 'Đã huấn luyện mô hình nhận diện đối tượng vi phạm (không đội mũ, không mặc áo phản quang) và kích hoạt tín hiệu cảnh báo tức thời.',
        remainingIssues: 'Chưa nhận diện được bối cảnh môi trường nguy hiểm xung quanh (vùng mép sàn không có rào chắn, khu vực dưới cần cẩu, vùng vật rơi).',
        nextTasks: 'Mở rộng mô hình nhận diện bối cảnh môi trường công trường lớn; tích hợp AI phân tích nguy cơ rủi ro tai nạn; chuẩn bị báo cáo 4 nội dung trọng tâm.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Hoàn thiện phân tích rủi ro môi trường xây dựng và phát cảnh báo đa cấp độ. Trình bày rõ 4 nội dung: Mô hình YOLO11 tối ưu, Bộ dữ liệu thực tế công trường, Ứng dụng thị giác máy tính, và Bảng đánh giá so sánh định lượng độ chính xác so với các giải pháp hiện có.',
        remainingIssues: 'Độ trễ xử lý camera RTSP đôi khi dao động khi truyền nhiều luồng đồng thời.',
        nextTasks: 'Hoàn thiện slide thuyết trình và chuẩn bị hồ sơ đánh giá BM04.',
        progressRating: 'ON_TRACK',
      },
    ],
    isReadyForEvaluation: true,
    evaluationStatus: 'DRAFT',
  },
  {
    studentIndex: 4, // sv004
    mentorIndex: 1,  // lecturer02 (ThS. Trần Thị Mai Phương)
    title: 'Xây dựng website quản lý quy trình thực hiện đồ án tốt nghiệp tại Viện Công nghệ số trên nền tảng ReactJS và NodeJS',
    description: 'Hệ thống số hóa quy trình đồ án tốt nghiệp toàn diện: quản lý đề tài, thẩm định BM01, phân công hội đồng, BM02, theo dõi tiến độ BM03, AI gợi ý BM04 và lưu chiểu.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Khảo sát quy trình nghiệp vụ tốt nghiệp tại Viện Công nghệ số; thiết kế kiến trúc CSDL PostgreSQL trên Supabase; dựng khung frontend ReactJS và backend NodeJS; xây dựng các chức năng cơ bản cho sinh viên và giáo viên.',
        remainingIssues: 'Chưa cụ thể hóa luồng lưu trữ và trạng thái theo đúng biểu mẫu: đăng ký đề tài -> đề cương BM01 -> hội đồng thẩm định -> QĐ giao đề tài -> BM02-A -> quản lý tiến độ BM03.',
        nextTasks: 'Cụ thể hóa quy trình và chuẩn hóa luồng biểu mẫu; xây dựng tính năng theo dõi tiến độ BM03 cho phép GVHD nhận xét kết quả và định hướng việc tiếp theo, SV phản hồi.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Hội thảo Bộ môn KTPM - P.B202',
        studentCompletedWork: 'Xây dựng hoàn chỉnh phân hệ theo dõi tiến độ BM03: GVHD ghi nhận nhận xét kết quả đạt được và gợi ý kế tiếp, sinh viên phản hồi xác nhận; xuất phiếu báo tiến độ BM03 chuẩn A4.',
        remainingIssues: 'Giáo viên phải tự soạn toàn bộ nhận xét BM04 thủ công tốn thời gian; chưa có hỗ trợ AI phân tích tiến độ BM03 để gợi ý nhận xét; chưa có tính năng AI đọc chuyên môn GV để phân công hội đồng.',
        nextTasks: 'Tích hợp tính năng AI đưa ra nhận xét gợi ý BM04 dựa vào các mốc tiến độ BM03 và báo cáo nộp; nghiên cứu AI phân công hội đồng phù hợp chuyên môn; tinh chỉnh giao diện người dùng.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Tối ưu hóa toàn bộ giao diện và luồng quy trình nghiệp vụ; tích hợp thành công AI hỗ trợ sinh nhận xét BM04 từ dữ liệu mốc tiến độ BM03 đạt độ chính xác cao và tiết kiệm thời gian cho giảng viên; hoàn thiện tài liệu thuyết minh đồ án và xuất biểu mẫu PDF chuẩn.',
        remainingIssues: 'Cần rà soát và kiểm thử tương thích hiển thị trên một số trình duyệt di động.',
        nextTasks: 'Hoàn thiện hồ sơ nghiệm thu BM04 và bảo vệ đồ án trước Hội đồng.',
        progressRating: 'ON_TRACK',
      },
    ],
    isReadyForEvaluation: true,
    evaluationStatus: 'DRAFT',
  },
  {
    studentIndex: 5, // sv005
    mentorIndex: 1,  // lecturer02 (ThS. Trần Thị Mai Phương)
    title: 'Ứng dụng học sâu và trí tuệ nhân tạo cục bộ (Local AI) trong nhận diện và phân loại rác thải tái chế',
    description: 'Ứng dụng di động nhận diện và phân loại rác thải bằng YOLOv8, tích hợp Local AI ngoại tuyến gợi ý phương pháp tái chế và bản đồ điểm thu gom.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Thu thập tập dữ liệu Taco (700 mẫu) và Roboflow (11.406 mẫu). Đang thử nghiệm tiền xử lý dữ liệu và thiết kế giao diện quét camera đưa ra thông số nhận diện.',
        remainingIssues: 'Chưa huấn luyện mô hình YOLOv8 riêng biệt; chưa có đánh giá so sánh độ chính xác định lượng giữa các mô hình.',
        nextTasks: 'Huấn luyện mô hình riêng trên tập dữ liệu tổng hợp; bổ sung mẫu chụp thực tế địa phương; thiết lập phương pháp so sánh độ chính xác.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Hội thảo Bộ môn KTPM - P.B202',
        studentCompletedWork: 'Bổ sung 168 mẫu chụp thực tế; huấn luyện mô hình mới và tiến hành so sánh độ chính xác khi thêm dữ liệu; bước đầu tích hợp Local AI gợi ý cách tái chế; kết nối hiển thị các điểm thu gom rác lên bản đồ.',
        remainingIssues: 'Mô hình tự huấn luyện (dựa trên YOLOv3) cho kết quả chưa bằng YOLOv5 chuẩn; cần giải pháp tối ưu để kết quả đạt tương đương; cần đọc chi tiết thông tin điểm thu gom (loại rác nhận tái chế chính).',
        nextTasks: 'Cải tiến kiến trúc mô hình lên YOLOv8 để đạt độ chính xác cao hơn; hoàn thiện Local AI gợi ý tái chế sáng tạo ngoại tuyến; làm giàu dữ liệu chi tiết các điểm thu gom trên bản đồ.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Tối ưu hóa mô hình đạt độ chính xác vượt trội; tích hợp cơ chế tự học từ dataset định kỳ; hoàn thiện Local AI ngoại tuyến gợi ý tái chế linh hoạt; hiển thị chi tiết mạng lưới điểm thu gom và chỉ đường trên bản đồ số.',
        remainingIssues: 'Dung lượng mô hình nén trên thiết bị di động cần tiếp tục tinh gọn.',
        nextTasks: 'Đóng gói ứng dụng di động, hoàn thiện báo cáo và hồ sơ BM04.',
        progressRating: 'ON_TRACK',
      },
    ],
    isReadyForEvaluation: true,
    evaluationStatus: 'DRAFT',
  },
  {
    studentIndex: 6, // sv006
    mentorIndex: 1,  // lecturer02 (ThS. Trần Thị Mai Phương)
    title: 'Thiết kế và triển khai hệ thống mạng doanh nghiệp tích hợp bảo mật, giám sát và tự động hóa trên môi trường giả lập EVE-NG',
    description: 'Hệ thống mạng doanh nghiệp phân tán: cấu hình VLAN, OSPF, ACL bảo mật, máy chủ phân quyền Active Directory, giám sát Zabbix và tự động hóa Ansible.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Thiết kế sơ đồ Topology mạng doanh nghiệp đa chi nhánh trên môi trường giả lập EVE-NG; phân rã các khối chức năng chính (Core, Distribution, Access, DMZ, Server Farm).',
        remainingIssues: 'Cần làm rõ mục đích kết nối máy ảo và gán IP trong EVE-NG; chưa xác định rõ số lượng thiết bị mạng và kiểm tra khả năng đáp ứng tài nguyên của máy chủ mô phỏng.',
        nextTasks: 'Kiểm tra thực tế khả năng chạy của thiết bị trong topo; cấu hình sơ đồ mạng cơ bản, phân chia VLAN và thiết lập Access-List (ACL) phân quyền truy cập.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Hội thảo Bộ môn KTPM - P.B202',
        studentCompletedWork: 'Đã hoàn thành dựng toàn bộ sơ đồ thiết bị trên EVE-NG; cấu hình định tuyến và Access-List kiểm soát truy cập; cấu hình máy chủ quản lý tài nguyên phân quyền theo nhóm; ghi nhận log trạng thái thiết bị.',
        remainingIssues: 'Chưa triển khai máy chủ giám sát Zabbix cảnh báo bất thường; chưa triển khai các kịch bản tự động hóa sao chép cấu hình và tự phục hồi lỗi.',
        nextTasks: 'Cài đặt máy chủ Zabbix giám sát lưu lượng và gửi cảnh báo; nghiên cứu viết kịch bản Python/Ansible tự động hóa sao chép cấu hình thiết bị và tự sửa lỗi mạng.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Hoàn thiện toàn bộ hạ tầng mạng doanh nghiệp: chính sách bảo mật ACL nghiêm ngặt, máy chủ giám sát Zabbix gửi cảnh báo thời gian thực; tự động hóa sao lưu và đồng bộ cấu hình tự động khi phát hiện lỗi; hệ thống hoạt động ổn định và tin cậy.',
        remainingIssues: 'Cần bổ sung thêm tài liệu hướng dẫn vận hành và quy trình ứng cứu sự cố.',
        nextTasks: 'Hoàn thiện báo cáo đồ án, slide trình chiếu và chuẩn bị đánh giá BM04.',
        progressRating: 'ON_TRACK',
      },
    ],
    isReadyForEvaluation: true,
    evaluationStatus: 'DRAFT',
  },
  {
    studentIndex: 7, // sv007
    mentorIndex: 2,  // lecturer03 (TS. Lê Hoàng Nam)
    title: 'Xây dựng website thương mại điện tử tích hợp trí tuệ nhân tạo hỗ trợ tư vấn và quản lý bán hàng thông minh',
    description: 'Sàn thương mại điện tử tích hợp AI Chatbot tư vấn, so sánh thông số, AI tạo mô tả sản phẩm tự động, dự báo tồn kho và chăm sóc khách hàng thông minh.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Định nghĩa danh mục chức năng hệ thống; thiết kế và khởi tạo CSDL; xây dựng các tính năng cơ bản của website bán hàng trên nền tảng .NET Core MVC.',
        remainingIssues: 'Hệ thống đang viết theo mô hình MVC nguyên khối; xem xét chuyển sang kiến trúc phân tách Backend API và Frontend SPA; các chức năng AI chưa triển khai.',
        nextTasks: 'Tái cấu trúc API; tích hợp Chatbot AI hỗ trợ tìm kiếm sản phẩm và so sánh thông tin; nghiên cứu tính năng AI hỗ trợ admin phản hồi khách hàng và viết mô tả sản phẩm.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Nghiên cứu AI & Hệ thống Thông tin - P.B301',
        studentCompletedWork: 'Tích hợp Chatbot tìm kiếm và so sánh sản phẩm; phát triển AI viết mô tả sản phẩm tự động; xây dựng mô hình AI cảnh báo nguy cơ hết hàng dựa trên số lượng tồn kho và tần suất bán.',
        remainingIssues: 'Cần mở rộng tính năng AI chăm sóc khách hàng tự động tạo và gửi phản hồi bình luận; tinh chỉnh ngưỡng cảnh báo nhập hàng thông minh.',
        nextTasks: 'Hoàn thiện tính năng AI tự động hóa phản hồi đánh giá của khách hàng; tối ưu thuật toán gợi ý số lượng nhập hàng; kiểm thử toàn diện hệ thống.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Hoàn thiện trọn vẹn nền tảng e-commerce: Chatbot tư vấn thông minh, AI tự động tạo mô tả và phản hồi khách hàng, AI cảnh báo hết hàng và đề xuất kế hoạch nhập kho chính xác; toàn bộ các luồng giao dịch vận hành ổn định.',
        remainingIssues: 'Tất cả các yêu cầu đã được giải quyết triệt để.',
        nextTasks: 'Đã hoàn thành đánh giá BM04, đủ điều kiện bảo vệ trước Hội đồng.',
        progressRating: 'ON_TRACK',
      },
    ],
    isCompleted: true,
    evaluationStatus: 'SIGNED_APPROVED',
    thesisFormatScore: 'Báo cáo đồ án trình bày rất chuẩn mực theo đúng quy định của Viện Công nghệ số - Đại học Thủ Dầu Một. Cấu trúc chương mục logic, hình ảnh minh họa rõ nét, tài liệu tham khảo trích dẫn đầy đủ chuẩn IEEE.',
    researchContentScore: 'Nội dung nghiên cứu phong phú, ứng dụng hiệu quả các kỹ thuật AI tạo sinh và máy học trong lĩnh vực thương mại điện tử. Các module tư vấn, so sánh thông số và cảnh báo tồn kho hoạt động chính xác.',
    applicabilityScore: 'Website thương mại điện tử hoàn chỉnh, có tính ứng dụng thương mại thực tế cao. Giao diện trực quan, trải nghiệm người dùng mượt mà, tốc độ phản hồi nhanh.',
    attitudeScore: 'Sinh viên có tinh thần tự giác và trách nhiệm rất cao. Chủ động giải quyết các bài toán kỹ thuật phức tạp, nghiêm túc tiếp thu ý kiến hướng dẫn và hoàn thành trước thời hạn.',
  },
  {
    studentIndex: 8, // sv008
    mentorIndex: 2,  // lecturer03 (TS. Lê Hoàng Nam)
    title: 'Xây dựng ứng dụng hỗ trợ sinh viên theo dõi tiến độ học tập, cảnh báo sớm học vụ và gợi ý đăng ký học lại theo chương trình đào tạo',
    description: 'Hệ thống thông minh theo dõi điểm danh, tiến độ tín chỉ tích lũy, thuật toán dự báo rủi ro học vụ và tự động gợi ý kế hoạch trả nợ môn học tối ưu.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Khảo sát quy định đào tạo theo học chế tín chỉ; thiết kế CSDL quản lý sinh viên, học phần, điểm và lịch học; trích xuất dữ liệu đăng ký môn học thử nghiệm.',
        remainingIssues: 'Cấu trúc CSDL còn phức tạp và chưa tối ưu; chưa lưu vết điểm danh từng buổi học; chưa quản lý chi tiết số tín chỉ sinh viên đang nợ để đưa ra cảnh báo sớm.',
        nextTasks: 'Chuẩn hóa CSDL; xây dựng module lưu vết điểm danh và tính toán số tín chỉ nợ; tích hợp nhập dữ liệu tự động từ cổng đào tạo; nghiên cứu tiêu chí cảnh báo học vụ.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Nghiên cứu AI & Hệ thống Thông tin - P.B301',
        studentCompletedWork: 'Đồng bộ dữ liệu đăng ký môn học và hoàn thành Module 1 theo dõi tiến độ học tập; thiết lập các quy tắc cảnh báo học vụ theo 3 trường hợp: vắng học >20%, nợ tích lũy >24 tín chỉ, và dự báo điểm trung bình tích lũy sụt giảm.',
        remainingIssues: 'Chưa có thuật toán thông minh gợi ý danh sách học phần nên đăng ký học lại phù hợp với điều kiện tiên quyết và khả năng cá nhân.',
        nextTasks: 'Xây dựng thuật toán tối ưu gợi ý số lượng tín chỉ và học phần cần trả nợ trong từng học kỳ để đảm bảo đúng tiến độ tốt nghiệp; hoàn thiện giao diện cảnh báo sớm.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Hoàn thiện ứng dụng toàn diện: giao diện theo dõi tiến độ trực quan, hệ thống cảnh báo sớm 3 cấp độ kịp thời và chính xác, thuật toán gợi ý đăng ký học lại tối ưu dựa trên cây môn học tiên quyết; đã thử nghiệm trên dữ liệu sinh viên thực tế.',
        remainingIssues: 'Đã hoàn thiện đầy đủ các mục tiêu đề tài.',
        nextTasks: 'Đã hoàn thành đánh giá BM04, đủ điều kiện bảo vệ trước Hội đồng.',
        progressRating: 'ON_TRACK',
      },
    ],
    isCompleted: true,
    evaluationStatus: 'SIGNED_APPROVED',
    thesisFormatScore: 'Hình thức quyển đồ án đạt chuẩn chất lượng cao, văn phong khoa học trong sáng, bảng biểu và sơ đồ luồng dữ liệu minh bạch, đáp ứng tuyệt đối quy chuẩn kỹ thuật.',
    researchContentScore: 'Đề tài giải quyết bài toán nghiệp vụ học vụ rất thiết thực. Thuật toán dự báo rủi ro học vụ và tối ưu hóa kế hoạch trả nợ môn học được xây dựng chặt chẽ và có tính thuyết phục cao.',
    applicabilityScore: 'Phần mềm có khả năng áp dụng thực tiễn ngay tại các trường đại học để hỗ trợ sinh viên và phòng đào tạo. Giao diện thân thiện, dễ sử dụng.',
    attitudeScore: 'Sinh viên chăm chỉ, cần mẫn và có tính kỷ luật cao. Luôn bám sát kế hoạch hướng dẫn hàng tuần, nộp báo cáo đúng hạn và chủ động tìm tòi giải pháp tối ưu.',
  },
  {
    studentIndex: 9, // sv009
    mentorIndex: 0,  // lecturer01 (TS. Nguyễn Văn Thắng)
    title: 'Xây dựng website ứng dụng AI tự động hóa quy trình quản lý chung cư SKYLINE',
    description: 'Hệ thống quản lý chung cư thông minh: quản lý cư dân, cấp mã QR khách viếng thăm, Chatbot tiện ích, AI nhận diện hình ảnh sự cố và tự động hóa hóa đơn.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Phân tích 6 module hệ thống: Quản lý cư dân, Quản trị Admin, Bảo trì sự cố, An ninh, Trao đổi thông tin và AI; thiết kế prototype giao diện trên Stitch Google; khởi tạo CSDL PostgreSQL.',
        remainingIssues: 'Mới hoàn thành khung CSDL; cần ưu tiên xây dựng chức năng quản lý cư dân, cấp mã QR cho khách viếng thăm và tiếp nhận thông tin phản ánh sự cố.',
        nextTasks: 'Hoàn thiện Module 1 quản lý thông tin cư dân và mã QR khách; xây dựng giao diện đăng ký tiện ích và tiếp nhận báo cáo sự cố kèm hình ảnh.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Nghiên cứu AI & Hệ thống Thông tin - P.B301',
        studentCompletedWork: 'Hoàn thành Module 1 quản lý cư dân và tạo mã QR cho khách; tích hợp Chatbot đặt dịch vụ tiện ích nội khu (Module 2); phát triển AI phân tích hình ảnh sự cố gửi gợi ý xử lý ban đầu cho cư dân (Module 3).',
        remainingIssues: 'Module tính hóa đơn dịch vụ hàng tháng đang xây dựng dở dang; AI phản hồi ý kiến cư dân cần được huấn luyện thêm dữ liệu câu hỏi thường gặp.',
        nextTasks: 'Hoàn thiện tính năng tự động tính toán hóa đơn phí dịch vụ; huấn luyện AI tự động trả lời phản ánh cư dân; kiểm thử liên thông 6 module.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Viện Công nghệ số - P.A102',
        studentCompletedWork: 'Hoàn thành trọn vẹn toàn bộ 6 module: ứng dụng AI tự động hóa xử lý sự cố qua hình ảnh, AI trả lời phản ánh cư dân 24/7, tự động hóa phát hành hóa đơn hàng tháng và quản lý an ninh bằng mã QR; hệ thống vận hành trơn tru và bảo mật cao.',
        remainingIssues: 'Đã giải quyết toàn diện tất cả các yêu cầu.',
        nextTasks: 'Đã hoàn thành đánh giá BM04, đủ điều kiện bảo vệ trước Hội đồng.',
        progressRating: 'ON_TRACK',
      },
    ],
    isCompleted: true,
    evaluationStatus: 'SIGNED_APPROVED',
    thesisFormatScore: 'Thuyết minh đồ án được biên soạn công phu, định dạng đúng quy chuẩn, đầy đủ sơ đồ kiến trúc hệ thống, sơ đồ CSDL và giao diện các chức năng.',
    researchContentScore: 'Đề tài tích hợp xuất sắc các công nghệ web hiện đại với trí tuệ nhân tạo. Mô hình AI phân tích ảnh sự cố và tự động hóa quy trình quản lý cư dân đạt hiệu quả rất rõ rệt.',
    applicabilityScore: 'Hệ thống hoàn chỉnh, sẵn sàng triển khai thực tế cho các ban quản lý tòa nhà, chung cư thông minh nhằm giảm tải chi phí vận hành.',
    attitudeScore: 'Sinh viên làm việc độc lập và sáng tạo, tuân thủ nghiêm túc các mốc tiến độ BM03 và có khả năng nghiên cứu thực nghiệm xuất sắc.',
  },
  {
    studentIndex: 10, // sv010
    mentorIndex: 1,   // lecturer02 (ThS. Trần Thị Mai Phương)
    title: 'Xây dựng nền tảng so sánh giá và đánh giá sản phẩm thông minh ứng dụng học máy và Benchmark tự động',
    description: 'Nền tảng mua sắm thông minh: so sánh giá đa sàn, thuật toán Benchmark tự động chấm điểm kỹ thuật sản phẩm, phân tích sentiment đánh giá và Chatbot mua sắm.',
    meetings: [
      {
        meetingDate: new Date('2026-08-24T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Khảo sát các nền tảng so sánh giá thương mại điện tử; thiết kế giao diện đối chiếu sản phẩm; xây dựng cấu trúc CSDL lưu trữ thông số kỹ thuật và giá cả.',
        remainingIssues: 'Chưa xác định mô hình AI cụ thể; chưa làm rõ ý nghĩa và thuật toán của module Benchmark trong việc hỗ trợ người dùng ra quyết định.',
        nextTasks: 'Nghiên cứu ứng dụng AI và thuật toán Benchmark; thiết kế luồng người dùng chọn thuộc tính để hệ thống gợi ý và so sánh sản phẩm tương đồng; xây dựng Chatbot tìm kiếm.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-09-21T08:30:00Z'),
        locationOrLink: 'Phòng Hội thảo Bộ môn KTPM - P.B202',
        studentCompletedWork: 'Xây dựng tính năng so sánh đa thuộc tính giữa các sản phẩm; tích hợp Chatbot tìm sản phẩm cho khách và tìm đơn hàng cho admin; hoàn thành chức năng import danh mục sản phẩm tự động từ Excel.',
        remainingIssues: 'Thuật toán Benchmark tự động cần làm rõ cơ chế chấm điểm định lượng để đối chiếu với đánh giá của người mua.',
        nextTasks: 'Hoàn thiện thuật toán Benchmark tự động tính điểm chỉ số kỹ thuật sản phẩm kết hợp phân tích sắc thái đánh giá người dùng; hoàn thiện giao diện báo cáo.',
        progressRating: 'ON_TRACK',
      },
      {
        meetingDate: new Date('2026-10-19T08:30:00Z'),
        locationOrLink: 'Văn phòng Bộ môn KTPM & HTTT - P.A204',
        studentCompletedWork: 'Hoàn thiện nền tảng toàn diện: thuật toán Benchmark tự động chấm điểm khách quan và tin cậy cho từng sản phẩm; Chatbot AI đa năng hỗ trợ tra cứu và mua sắm thông minh; tính năng tự động nhập dữ liệu và so sánh giá hoạt động mượt mà.',
        remainingIssues: 'Đã hoàn thành xuất sắc tất cả các mục tiêu.',
        nextTasks: 'Đã hoàn thành đánh giá BM04, đủ điều kiện bảo vệ trước Hội đồng.',
        progressRating: 'ON_TRACK',
      },
    ],
    isCompleted: true,
    evaluationStatus: 'SIGNED_APPROVED',
    thesisFormatScore: 'Báo cáo được trình bày khoa học, ngôn ngữ mạch lạc, phân tích thuật toán Benchmark và mô hình học máy chi tiết, đồ họa minh họa đẹp mắt.',
    researchContentScore: 'Đề tài có tính học thuật và thực tiễn cao. Thuật toán Benchmark kết hợp phân tích sắc thái sentiment giúp người tiêu dùng lựa chọn sản phẩm tối ưu một cách tin cậy.',
    applicabilityScore: 'Nền tảng chạy mượt mà trên môi trường web, hỗ trợ nhập dữ liệu tự động và truy vấn thời gian thực, có giá trị ứng dụng cao cho cộng đồng người tiêu dùng.',
    attitudeScore: 'Sinh viên cầu thị, có tư duy phân tích phản biện sắc bén, tiếp thu nhanh các góp ý khoa học và hoàn thành trọn vẹn toàn bộ các cam kết.',
  },
];

async function seedTenStudentsBM04AcademicFixtures({ prisma, accountsByEmail, baseDate = new Date() }) {
  const now = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  const semesterDefs = getSemesterDefinitions(now);

  const admin = accountsByEmail.get('admin@university.edu.vn');
  const lecturer01 = accountsByEmail.get('lecturer01@university.edu.vn'); // TS. Nguyễn Văn Thắng (Viện trưởng)
  const lecturer02 = accountsByEmail.get('lecturer02@university.edu.vn'); // ThS. Trần Thị Mai Phương (Trưởng bộ môn)
  const lecturer03 = accountsByEmail.get('lecturer03@university.edu.vn'); // TS. Lê Hoàng Nam

  const mentorsList = [lecturer01, lecturer02, lecturer03];

  // 1. Create 2 Semesters (HK1: Ongoing Defense stage, HK2: Supplementary)
  const semesterHK1Record = await prisma.semester.create({
    data: {
      ...semesterDefs.semesterHK1,
      status: 'ONGOING',
      outlineSubmissionOpenAt: addDays(now, -90),
      outlineSubmissionDeadline: addDays(now, -70),
      lockedPolicyVersionId: null,
    },
  });

  const semesterHK2Record = await prisma.semester.create({
    data: {
      ...semesterDefs.semesterHK2,
      status: 'UPCOMING',
      registrationOpen: false,
      startDate: addDays(now, 30),
      endDate: addDays(now, 150),
      outlineSubmissionOpenAt: addDays(now, 35),
      outlineSubmissionDeadline: addDays(now, 55),
      lockedPolicyVersionId: null,
    },
  });

  // 2. Workflow Policy Versions
  const policyHK1 = await prisma.periodWorkflowPolicyVersion.create({
    data: {
      semesterId: semesterHK1Record.id,
      version: 1,
      policy: DEFAULT_POLICY,
      checksum: checksum(DEFAULT_POLICY),
      createdById: admin.id,
    },
  });

  const policyHK2 = await prisma.periodWorkflowPolicyVersion.create({
    data: {
      semesterId: semesterHK2Record.id,
      version: 1,
      policy: DEFAULT_POLICY,
      checksum: checksum(DEFAULT_POLICY),
      createdById: admin.id,
    },
  });

  // 3. Project Catalog
  const catalog = await prisma.projectCatalog.create({
    data: {
      code: 'DATN',
      name: 'Đồ án tốt nghiệp',
      isActive: true,
    },
  });

  // 4. Standardized Rubric (4 groups, 14 criteria)
  const rubric = await prisma.rubricVersion.create({
    data: {
      version: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.version,
      title: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.title,
      description: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.description,
      totalMaxScore: 10.0,
      isActive: true,
      status: 'ACTIVE',
      lockedAt: addDays(now, -10),
      lockedById: admin.id,
      createdById: admin.id,
      categories: {
        create: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.categories.map((cat, cIdx) => ({
          code: cat.code,
          name: cat.name,
          description: cat.description,
          maxScore: cat.maxScore,
          orderIndex: cat.orderIndex || cIdx + 1,
          criteria: {
            create: cat.criteria.map((crit, crIdx) => ({
              code: crit.code,
              label: crit.label,
              description: crit.description,
              maxScore: crit.maxScore,
              orderIndex: crit.orderIndex || crIdx + 1,
              cloCode: crit.cloCode,
              levelGoodDesc: crit.levelGoodDesc,
              levelFairDesc: crit.levelFairDesc,
              levelAverageDesc: crit.levelFairDesc,
              levelPoorDesc: crit.levelPoorDesc,
            })),
          },
        })),
      },
    },
  });

  // 5. Academic Delegations
  await prisma.academicDelegation.createMany({
    data: [
      {
        delegatorId: lecturer01.id,
        delegateeId: lecturer02.id,
        capabilityCode: 'BM02_REVIEW',
        department: 'Viện Công nghệ số',
        semesterId: semesterHK1Record.id,
        effectiveFrom: addDays(now, -80),
        effectiveTo: addDays(now, 100),
        reason: 'Ủy quyền Phụ trách bộ môn thẩm định BM02',
        idempotencyKey: 'phase2-10sv-delegation-bm02-review',
        status: 'ACTIVE',
      },
      {
        delegatorId: lecturer01.id,
        delegateeId: lecturer02.id,
        capabilityCode: 'BM02A_FINAL_APPROVE',
        department: 'Viện Công nghệ số',
        semesterId: semesterHK1Record.id,
        effectiveFrom: addDays(now, -80),
        effectiveTo: addDays(now, 100),
        reason: 'Ủy quyền Phụ trách bộ môn ký duyệt bước 3 BM02-A',
        idempotencyKey: 'phase2-10sv-delegation-bm02a-approve',
        status: 'ACTIVE',
      },
    ],
  });

  // 6. Defense Councils (Zero-COI: Members are lecturers 4, 5, 6 and 7, 8, 9)
  const lecturers = [...accountsByEmail.values()]
    .filter((u) => u.role === 'LECTURER')
    .sort((a, b) => a.email.localeCompare(b.email));

  const councilMembers1 = lecturers.slice(3, 6); // lecturer04, 05, 06
  const councilMembers2 = lecturers.slice(6, 9); // lecturer07, 08, 09

  const council1 = await prisma.council.create({
    data: {
      semesterId: semesterHK1Record.id,
      name: 'Hội đồng bảo vệ đồ án tốt nghiệp 01',
      councilType: 'DEFENSE_COUNCIL',
      location: 'Hội trường B201',
      defenseDate: addDays(now, 10),
      meetingMode: 'IN_PERSON',
      schedulePublishedAt: addDays(now, -2),
      rubricVersionId: rubric.id,
      scoreBookLocked: false,
    },
  });
  await prisma.councilMember.createMany({
    data: councilMembers1.map((lec, mIdx) => ({
      councilId: council1.id,
      lecturerId: lec.id,
      roleInCouncil: ['CHAIRMAN', 'SECRETARY', 'REVIEWER'][mIdx],
      isScoringMember: true,
      isActive: true,
    })),
  });

  const council2 = await prisma.council.create({
    data: {
      semesterId: semesterHK1Record.id,
      name: 'Hội đồng bảo vệ đồ án tốt nghiệp 02',
      councilType: 'DEFENSE_COUNCIL',
      location: 'Hội trường B202',
      defenseDate: addDays(now, 10),
      meetingMode: 'IN_PERSON',
      schedulePublishedAt: addDays(now, -2),
      rubricVersionId: rubric.id,
      scoreBookLocked: false,
    },
  });
  await prisma.councilMember.createMany({
    data: councilMembers2.map((lec, mIdx) => ({
      councilId: council2.id,
      lecturerId: lec.id,
      roleInCouncil: ['CHAIRMAN', 'SECRETARY', 'REVIEWER'][mIdx],
      isScoringMember: true,
      isActive: true,
    })),
  });

  // 7. Quyết định giao đề tài HK1
  const decisionPublishedAt = addDays(now, -70);
  const hk1Decision = await prisma.topicAssignmentDecision.create({
    data: {
      semesterId: semesterHK1Record.id,
      decisionNumber: 'QĐ-128/QĐ-ĐHTDM-VCNS',
      decisionDate: decisionPublishedAt,
      decisionPublishedAt,
      fileUrl: '/uploads/decisions/QD-128-DHTDM-VCNS.pdf',
      fileName: 'QD-128-DHTDM-VCNS.pdf',
      issuedById: lecturer01.id,
      policyVersionId: policyHK1.id,
      status: 'PUBLISHED',
      idempotencyKey: 'phase2-10sv-published-decision',
    },
  });

  // 8. Students: Profiles & Enrollments
  const students = [...accountsByEmail.values()]
    .filter((u) => u.role === 'STUDENT')
    .sort((a, b) => a.email.localeCompare(b.email))
    .slice(0, 10);

  const profileRows = [];
  const studentSnapshots = new Map();
  for (let idx = 0; idx < students.length; idx += 1) {
    const student = students[idx];
    const number = idx + 1;
    const { dbProfile, snapshot } = buildStudentProfileData(number, student);
    dbProfile.className = number <= 5 ? 'D22CNTT01' : 'D22CNTT02';
    dbProfile.major = 'Công nghệ thông tin';
    snapshot.className = dbProfile.className;
    snapshot.major = dbProfile.major;
    profileRows.push(dbProfile);
    studentSnapshots.set(number, snapshot);
  }
  await prisma.studentProfile.createMany({ data: profileRows });

  // 9. Iterate 10 Topics & Create All BM01 - BM04 Artifacts
  const registrations = new Map();

  for (let idx = 0; idx < TEN_STUDENTS_TOPICS.length; idx += 1) {
    const topicConfig = TEN_STUDENTS_TOPICS[idx];
    const number = topicConfig.studentIndex;
    const student = students[number - 1];
    const mentor = mentorsList[topicConfig.mentorIndex];
    const padStr = String(number).padStart(3, '0');
    const studentSnap = studentSnapshots.get(number);

    // Active Enrollment
    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    // Topic
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: topicConfig.title,
        description: topicConfig.description,
        status: 'APPROVED',
      },
    });

    // Registration Status:
    // sv001..sv006: BM03_PASSED, BM04 is ready for evaluation
    // sv007..sv010: DEFENSE_READY, BM04 is completed and signed
    const isCompleted = Boolean(topicConfig.isCompleted);
    const regStatus = isCompleted ? 'DEFENSE_READY' : 'BM03_PASSED';
    const assignedCouncil = isCompleted ? (number <= 8 ? council1 : council2) : null;

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: regStatus,
        outlineReviewStatus: 'PASSED',
        bm01ApprovedTitleSnapshot: topicConfig.title,
        decisionNumber: hk1Decision.decisionNumber,
        decisionDate: hk1Decision.decisionDate,
        decisionPublishedAt: hk1Decision.decisionPublishedAt,
        defenseCouncilId: assignedCouncil ? assignedCouncil.id : null,
        defenseSessionShift: isCompleted ? (number % 2 === 1 ? 'MORNING' : 'AFTERNOON') : null,
        defenseOrderInShift: isCompleted ? (number % 2 === 1 ? 1 : 2) : null,
        defenseSequenceNo: isCompleted ? number : null,
        defenseSchedulePublishedAt: isCompleted ? addDays(now, -2) : null,
        stateVersion: 3,
      },
    });

    // BM02 Submission (Approved)
    const bm02 = await prisma.bM02Submission.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        content: `Đơn đăng ký đề tài BM02 của sinh viên ${student.fullName}.`,
        bm01ApprovedTitle: topicConfig.title,
        bm02ProposedTitle: topicConfig.title,
        studentSnapshot: studentSnap,
        mentorSnapshot: { id: mentor.id, fullName: mentor.fullName, email: mentor.email, code: mentor.code },
        fileUrl: `/uploads/demo/bm02/BM02_HK1_SV${padStr}.pdf`,
        fileName: `BM02_HK1_SV${padStr}.pdf`,
        submittedById: student.id,
        submittedAt: addDays(now, -75),
        reviewedById: lecturer02.id,
        reviewedAt: addDays(now, -71),
        notifiedAt: addDays(now, -71),
        policyVersionId: policyHK1.id,
      },
    });

    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { currentBM02SubmissionId: bm02.id },
    });

    // Decision item linking
    await prisma.topicAssignmentDecisionItem.create({
      data: {
        decisionId: hk1Decision.id,
        registrationId: registration.id,
        bm02SubmissionId: bm02.id,
        approvedTitleSnapshot: topicConfig.title,
        studentCodeSnapshot: student.code,
        studentNameSnapshot: student.fullName,
        mentorNameSnapshot: mentor.fullName,
      },
    });

    // Assignment decision for backward-compatibility
    await prisma.assignmentDecision.create({
      data: {
        registrationId: registration.id,
        bm02SubmissionId: bm02.id,
        decisionNumber: hk1Decision.decisionNumber,
        issuedAt: hk1Decision.decisionDate,
        effectiveAt: hk1Decision.decisionPublishedAt,
        issuedById: lecturer01.id,
        policyVersionId: policyHK1.id,
        idempotencyKey: `phase2-10sv-decision-${number}`,
      },
    });

    // BM03 Progress Record
    const bm03Record = await prisma.bM03ProgressRecord.create({
      data: {
        registrationId: registration.id,
        effectiveTitleSnapshot: topicConfig.title,
      },
    });

    // 3 Meeting Entries & Meeting Logs
    for (let mIdx = 0; mIdx < topicConfig.meetings.length; mIdx += 1) {
      const meet = topicConfig.meetings[mIdx];
      const meetDate = meet.meetingDate;

      const meetingPayload = {
        registrationId: registration.id,
        meetingNumber: mIdx + 1,
        meetingDate: meetDate.toISOString(),
        studentCompletedWork: meet.studentCompletedWork,
        remainingIssues: meet.remainingIssues,
        nextTasks: meet.nextTasks,
        progressRating: meet.progressRating,
        advisorId: mentor.id,
      };
      const meetHash = computeCanonicalPayloadHash(meetingPayload);

      await prisma.bM03MeetingEntry.create({
        data: {
          bm03RecordId: bm03Record.id,
          registrationId: registration.id,
          versionNumber: 1,
          meetingDate: meetDate,
          meetingMode: 'IN_PERSON',
          locationOrLink: meet.locationOrLink,
          discussionContent: `Buổi hướng dẫn định kỳ mốc ${mIdx + 1}: ${meet.studentCompletedWork}`,
          studentCompletedWork: meet.studentCompletedWork,
          remainingIssues: meet.remainingIssues,
          nextTasks: meet.nextTasks,
          expectedDeadline: addDays(meetDate, 20),
          progressRating: meet.progressRating,
          advisorSignedById: mentor.id,
          advisorSignedAt: addDays(meetDate, 1),
          payloadHash: meetHash,
          isLocked: true,
        },
      });

      // Synchronize into MeetingLog table
      await prisma.meetingLog.create({
        data: {
          registrationId: registration.id,
          meetingDate: meetDate,
          meetingType: 'LAB',
          studentWorkSummary: meet.studentCompletedWork,
          nextPlan: meet.nextTasks,
          supervisorNotes: `Đánh giá mốc ${mIdx + 1}: ${meet.remainingIssues || 'Đạt tiến độ đề ra.'}`,
          createdBy: mentor.id,
          createdAt: meetDate,
        },
      });
    }

    // 2 Checkpoint Evaluations (Giữa kỳ: 2026-09-25, Cuối kỳ: 2026-10-25)
    await prisma.checkpointEvaluation.create({
      data: {
        registrationId: registration.id,
        checkpointNo: 1,
        attemptNo: 1,
        conclusion: 'ALLOWED_TO_CONTINUE',
        comments: `Đánh giá tiến độ Giữa kỳ: Sinh viên ${student.fullName} đạt tiến độ đề ra theo đề cương. Tiếp tục triển khai các module tiếp theo.`,
        mentorSignedById: mentor.id,
        mentorSignedAt: new Date('2026-09-25T10:00:00Z'),
        mentorSignature: mentor.fullName,
        studentSignedById: student.id,
        studentSignedAt: new Date('2026-09-26T08:30:00Z'),
        studentSignature: student.fullName,
        policyVersionId: policyHK1.id,
      },
    });

    await prisma.checkpointEvaluation.create({
      data: {
        registrationId: registration.id,
        checkpointNo: 2,
        attemptNo: 1,
        conclusion: 'ALLOWED_TO_CONTINUE',
        comments: `Đánh giá tiến độ Cuối kỳ: Hoàn thành đầy đủ các chức năng và sản phẩm thực nghiệm, báo cáo đồ án đạt chuẩn kỹ thuật.`,
        mentorSignedById: mentor.id,
        mentorSignedAt: new Date('2026-10-25T10:00:00Z'),
        mentorSignature: mentor.fullName,
        studentSignedById: student.id,
        studentSignedAt: new Date('2026-10-26T08:30:00Z'),
        studentSignature: student.fullName,
        policyVersionId: policyHK1.id,
      },
    });

    // BM03 Stage Evaluations (Midterm & Final)
    const midEvalPayload = {
      registrationId: registration.id,
      stage: 'MIDTERM',
      decision: 'CONTINUE',
      evaluatedById: mentor.id,
    };
    const finalEvalPayload = {
      registrationId: registration.id,
      stage: 'FINAL',
      decision: 'CONTINUE_TO_BM04',
      evaluatedById: mentor.id,
    };

    const midEval = await prisma.bM03StageEvaluation.create({
      data: {
        bm03RecordId: bm03Record.id,
        registrationId: registration.id,
        stage: 'MIDTERM',
        decision: 'CONTINUE',
        comments: 'Tiến độ giữa kỳ đạt yêu cầu theo đề cương, sinh viên chủ động và bám sát kế hoạch.',
        evaluatedById: mentor.id,
        evaluatedAt: new Date('2026-09-25T11:00:00Z'),
        payloadHash: computeCanonicalPayloadHash(midEvalPayload),
      },
    });

    const finalEval = await prisma.bM03StageEvaluation.create({
      data: {
        bm03RecordId: bm03Record.id,
        registrationId: registration.id,
        stage: 'FINAL',
        decision: 'CONTINUE_TO_BM04',
        comments: 'Hoàn thành toàn diện các mốc tiến độ BM03, đủ điều kiện tiến hành đánh giá BM04 và bảo vệ.',
        evaluatedById: mentor.id,
        evaluatedAt: new Date('2026-10-25T11:00:00Z'),
        payloadHash: computeCanonicalPayloadHash(finalEvalPayload),
      },
    });

    // Update BM03 Record with signatures
    const bm03WholePayload = {
      registrationId: registration.id,
      effectiveTitleSnapshot: topicConfig.title,
      midtermStageEvaluationId: midEval.id,
      finalStageEvaluationId: finalEval.id,
      advisorId: mentor.id,
    };
    const bm03WholeHash = computeCanonicalPayloadHash(bm03WholePayload);

    await prisma.bM03ProgressRecord.update({
      where: { id: bm03Record.id },
      data: {
        midtermStageEvaluationId: midEval.id,
        finalStageEvaluationId: finalEval.id,
        advisorSignedById: mentor.id,
        advisorSignedAt: new Date('2026-10-26T14:00:00Z'),
        advisorPayloadHash: bm03WholeHash,
        studentAckStatus: 'ACKNOWLEDGED_WITH_COMMENT',
        studentAckAt: new Date('2026-10-27T09:00:00Z'),
        studentComment: 'Em đồng ý với toàn bộ nội dung nhật ký hướng dẫn BM03.',
        finalConclusion: 'Đủ điều kiện đánh giá BM04 và bảo vệ đồ án tốt nghiệp.',
        finalPdfFileUrl: `/uploads/demo/bm03/BM03_HK1_SV${padStr}.pdf`,
      },
    });

    // Workflow Tasks
    await prisma.task.createMany({
      data: [
        {
          registrationId: registration.id,
          title: 'BM01 - Đề cương chi tiết đồ án',
          content: 'Đã hoàn thành xét duyệt đề cương BM01.',
          taskType: 'BM01',
          status: 'COMPLETED',
        },
        {
          registrationId: registration.id,
          title: 'BM02 - Đơn đăng ký đề tài',
          content: 'Đã được duyệt đơn đăng ký đề tài và ban hành quyết định giao đề tài.',
          taskType: 'BM02',
          status: 'COMPLETED',
        },
        {
          registrationId: registration.id,
          title: 'BM03 - Nhật ký tiến độ hướng dẫn đồ án',
          content: 'Hoàn thành 3 mốc kiểm tra tiến độ định kỳ và đánh giá giữa kỳ/cuối kỳ.',
          taskType: 'BM03_CHECKPOINT',
          status: 'COMPLETED',
        },
        {
          registrationId: registration.id,
          title: 'BM04 - Đánh giá của Người hướng dẫn',
          content: isCompleted
            ? 'Người hướng dẫn đã hoàn thành thẩm định và ký duyệt phiếu BM04.'
            : 'Đang mở đợt thẩm định BM04. Giảng viên hướng dẫn lập phiếu đánh giá nhận xét hoặc sử dụng AI gợi ý từ tiến độ BM03.',
          taskType: 'BM04',
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        },
      ],
    });

    // BM04 Evaluation Record
    if (isCompleted) {
      // sv007..sv010: Completed, Signed & Locked -> Demo In Phiếu BM04
      const bm04Payload = {
        registrationId: registration.id,
        semesterId: semesterHK1Record.id,
        studentId: student.id,
        thesisFormatScore: topicConfig.thesisFormatScore,
        researchContentScore: topicConfig.researchContentScore,
        applicabilityScore: topicConfig.applicabilityScore,
        attitudeScore: topicConfig.attitudeScore,
        conclusion: 'AGREED_FOR_DEFENSE',
        generalNotes: 'Đề tài đáp ứng xuất sắc các tiêu chuẩn của đồ án tốt nghiệp đại học ngành Công nghệ thông tin. Đồng ý cho sinh viên bảo vệ trước Hội đồng.',
        advisorId: mentor.id,
      };
      const bm04Hash = computeCanonicalPayloadHash(bm04Payload);

      await prisma.bM04Evaluation.create({
        data: {
          registrationId: registration.id,
          semesterId: semesterHK1Record.id,
          studentId: student.id,
          lecturerId: mentor.id,
          thesisFormatScore: topicConfig.thesisFormatScore,
          researchContentScore: topicConfig.researchContentScore,
          applicabilityScore: topicConfig.applicabilityScore,
          attitudeScore: topicConfig.attitudeScore,
          conclusion: 'AGREED_FOR_DEFENSE',
          programOutcome: 'MEETS_PROGRAM_OUTCOMES',
          defenseRecommendation: 'APPROVE_FOR_DEFENSE',
          status: 'SIGNED_APPROVED',
          effectiveTitleSnapshot: topicConfig.title,
          studentClassSnapshot: studentSnap.className,
          generalNotes: 'Đề tài đáp ứng xuất sắc các tiêu chuẩn của đồ án tốt nghiệp đại học ngành Công nghệ thông tin. Đồng ý cho sinh viên bảo vệ trước Hội đồng.',
          lecturerSignature: mentor.fullName,
          payloadHash: bm04Hash,
          finalPdfFileUrl: `/uploads/demo/bm04/BM04_HK1_SV${padStr}.pdf`,
          signedAt: new Date('2026-10-28T09:30:00Z'),
          isLocked: true,
          policyVersionId: policyHK1.id,
        },
      });
    }

    registrations.set(number, {
      id: registration.id,
      student,
      mentor,
      topic,
      council: assignedCouncil,
    });
  }

  return {
    semesters: {
      semesterHK1: semesterHK1Record,
      semesterHK2: semesterHK2Record,
    },
    admin,
    director: lecturer01,
    mentors: mentorsList,
    councils: [council1, council2],
    decision: hk1Decision,
    registrations,
  };
}

module.exports = {
  TEN_STUDENTS_TOPICS,
  seedTenStudentsBM04AcademicFixtures,
};
