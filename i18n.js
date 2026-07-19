(() => {
    "use strict";

    const STORAGE_KEY = "gymrat:language";
    const DEFAULT_LANGUAGE = "en";
    const HEBREW_LANGUAGE = "he";

    const heText = new Map(Object.entries({
        "Home": "בית",
        "User": "משתמש",
        "Add": "הוסף",
        "➕ Add": "הוסף",
        "🗑 Delete": "מחק",
        "Workout plan": "תוכנית אימון",
        "Workouts": "אימונים",
        "Information": "מידע",
        "Training guide muscles": "מדריך אימונים לפי שרירים",
        "Anatomy Guide": "מדריך אנטומיה",
        "Watch all the muscles in every muscle group": "צפה בכל השרירים בכל קבוצת שרירים",
        "Explore the muscles behind each movement.": "למד את השרירים שמאחורי כל תנועה.",
        "Select a muscle group, open a muscle card, and add your researched function notes later.": "בחר קבוצת שרירים, פתח כרטיס שריר והוסף אחר כך הערות מחקר על התפקוד.",
        "Choose a section to view its muscles.": "בחר אזור כדי לראות את השרירים שלו.",
        "Read more": "קרא עוד",
        "Back to anatomy": "חזרה לאנטומיה",
        "Choose a muscle and press Read more when you are ready to fill in the function.": "בחר שריר ולחץ קרא עוד כשאתה מוכן לראות את התפקוד.",
        "In here will be the function of the muscle.": "כאן יופיע התפקוד של השריר.",
        "Muscles": "שרירים",
        "anatomy image": "תמונת אנטומיה",
        "Front Core And Deep Abs": "ליבה קדמית ושרירי בטן עמוקים",
        "Side Core": "ליבה צדית",
        "Superficial Back": "גב שטחי",
        "Posterior Shoulder And Rotator Cuff": "כתף אחורית ומסובבי הכתף",
        "Spinal Erectors And Deep Stabilizers": "זוקפי גב ומייצבים עמוקים",
        "Biceps Compartment": "מדור היד הקדמית",
        "Calf Muscles And Tibialis Anterior": "שרירי התאומים וטיביאליס קדמי",
        "Deep Posterior Lower Leg Muscles": "שרירים עמוקים בחלק האחורי של השוק",
        "Pectorals": "שרירי חזה",
        "Pressing Support": "תמיכת לחיצה",
        "Superficial Flexors": "כופפים שטחיים",
        "Intermediate Flexors": "כופפים בינוניים",
        "Deep Flexors": "כופפים עמוקים",
        "Superficial Extensors": "פושטים שטחיים",
        "Deep Extensors": "פושטים עמוקים",
        "Deep Hip Rotators": "מסובבי ירך עמוקים",
        "Adductors": "מקרבי ירך",
        "Anterior Hip Region": "אזור קדמת הירך",
        "Deltoids": "דלתא",
        "Rotator Cuff": "מסובבי הכתף",
        "Triceps Compartment": "מדור היד האחורית",
        "Rectus Abdominis": "ישר בטני",
        "Transversus Abdominis": "רחב בטני",
        "Serratus Anterior": "משור קדמי",
        "External Oblique": "אלכסון חיצוני",
        "Internal Oblique": "אלכסון פנימי",
        "Trapezius": "טרפז",
        "Levator Scapulae": "מרים השכמה",
        "Rhomboid Minor": "מעוין קטן",
        "Rhomboid Major": "מעוין גדול",
        "Latissimus Dorsi": "רחב גבי",
        "Supraspinatus": "על-קוצי",
        "Posterior Deltoid": "דלתא אחורית",
        "Infraspinatus": "תת-קוצי",
        "Teres Minor": "עגול קטן",
        "Teres Major": "עגול גדול",
        "Subscapularis": "תת-שכמתי",
        "Spinalis": "ספינליס",
        "Longissimus": "לונגיסימוס",
        "Iliocostalis": "איליוקוסטליס",
        "Multifidus": "מולטיפידוס",
        "Quadratus Lumborum": "מרובע מותני",
        "Coracobrachialis": "מקור-זרועי",
        "Biceps Brachii Long Head": "ראש ארוך של היד הקדמית",
        "Biceps Brachii Short Head": "ראש קצר של היד הקדמית",
        "Brachialis": "ברכיאליס",
        "Brachioradialis": "ברכיורדיאליס",
        "Gastrocnemius Medial Head": "ראש פנימי של התאומים",
        "Gastrocnemius Lateral Head": "ראש חיצוני של התאומים",
        "Soleus": "סולאוס",
        "Tibialis Anterior": "טיביאליס קדמי",
        "Popliteus": "פופליטאוס",
        "Tibialis Posterior": "טיביאליס אחורי",
        "Flexor Digitorum Longus": "כופף אצבעות ארוך",
        "Flexor Hallucis Longus": "כופף בוהן ארוך",
        "Pectoralis Major Clavicular Head": "ראש עצם הבריח של החזה הגדול",
        "Pectoralis Major Sternocostal Head": "ראש עצם החזה והצלעות של החזה הגדול",
        "Pectoralis Major Abdominal Head": "ראש בטני של החזה הגדול",
        "Pectoralis Minor": "חזה קטן",
        "Subclavius": "תת-בריחי",
        "Anterior Deltoid": "דלתא קדמית",
        "Pronator Teres": "כפן עגול",
        "Flexor Carpi Radialis": "כופף שורש כף יד חישורי",
        "Palmaris Longus": "כף יד ארוך",
        "Flexor Carpi Ulnaris": "כופף שורש כף יד גומדי",
        "Flexor Digitorum Superficialis": "כופף אצבעות שטחי",
        "Flexor Pollicis Longus": "כופף אגודל ארוך",
        "Flexor Digitorum Profundus": "כופף אצבעות עמוק",
        "Pronator Quadratus": "כפן מרובע",
        "Extensor Carpi Radialis Longus": "פושט שורש כף יד חישורי ארוך",
        "Extensor Carpi Radialis Brevis": "פושט שורש כף יד חישורי קצר",
        "Extensor Digitorum": "פושט האצבעות",
        "Extensor Digiti Minimi": "פושט הזרת",
        "Extensor Carpi Ulnaris": "פושט שורש כף יד גומדי",
        "Supinator": "מסובב החוצה",
        "Abductor Pollicis Longus": "מרחיק אגודל ארוך",
        "Extensor Pollicis Brevis": "פושט אגודל קצר",
        "Extensor Pollicis Longus": "פושט אגודל ארוך",
        "Extensor Indicis": "פושט האצבע המורה",
        "Gluteus Medius": "שריר העכוז האמצעי",
        "Gluteus Maximus": "שריר העכוז הגדול",
        "Gluteus Minimus": "שריר העכוז הקטן",
        "Piriformis": "אגסי",
        "Superior Gemellus": "תאום עליון",
        "Obturator Internus": "סותם פנימי",
        "Inferior Gemellus": "תאום תחתון",
        "Obturator Externus": "סותם חיצוני",
        "Quadratus Femoris": "מרובע הירך",
        "Biceps Femoris Long Head": "ראש ארוך של דו-ראשי ירכי",
        "Biceps Femoris Short Head": "ראש קצר של דו-ראשי ירכי",
        "Semitendinosus": "חצי גידי",
        "Semimembranosus": "חצי קרומי",
        "Pectineus": "מסרקתי",
        "Adductor Longus": "מקרב ארוך",
        "Adductor Brevis": "מקרב קצר",
        "Adductor Magnus": "מקרב גדול",
        "Gracilis": "עדין",
        "Rectus Femoris": "ישר ירכי",
        "Vastus Lateralis": "רחב צידי",
        "Vastus Intermedius": "רחב ביניים",
        "Vastus Medialis": "רחב פנימי",
        "Articularis Genus": "שריר מפרק הברך",
        "Psoas Major": "מותני גדול",
        "Psoas Minor": "מותני קטן",
        "Tensor Fasciae Latae": "מותח המחתלת הרחבה",
        "Sartorius": "חייטים",
        "Lateral Deltoid": "דלתא צידית",
        "Triceps Brachii Long Head": "ראש ארוך של היד האחורית",
        "Triceps Brachii Lateral Head": "ראש צידי של היד האחורית",
        "Triceps Brachii Medial Head": "ראש פנימי של היד האחורית",
        "Anconeus": "אנקונאוס",
        "Helps bend your upper body forward, like when doing a crunch. It also helps keep your core tight, pulls the pelvis slightly upward, and supports breathing out hard or bracing during lifting.": "עוזר לכופף את פלג הגוף העליון קדימה, כמו בכפיפת בטן. הוא גם עוזר לשמור על ליבה חזקה, מושך את האגן מעט כלפי מעלה ותומך בנשיפה חזקה או בברייסינג בזמן הרמה.",
        "Works like a natural belt around your waist. It squeezes the belly inward, supports the lower back, and helps keep your body stable when you lift, cough, breathe hard, or brace.": "פועל כמו חגורה טבעית סביב המותניים. הוא מכווץ את הבטן פנימה, תומך בגב התחתון ועוזר לשמור על יציבות בזמן הרמה, שיעול, נשימה חזקה או ברייסינג.",
        "Helps push the shoulder blade forward around the ribs, like when punching or pushing. It also helps lift the arm overhead and keeps the shoulder blade from sticking out.": "עוזר לדחוף את השכמה קדימה סביב הצלעות, כמו באגרוף או בדחיפה. הוא גם עוזר להרים את היד מעל הראש ושומר שהשכמה לא תבלוט החוצה.",
        "Helps twist your body to the opposite side, bend sideways, and bend forward. It also helps tighten the stomach area and supports breathing out hard.": "עוזר לסובב את הגוף לצד הנגדי, להתכופף הצידה ולהתכופף קדימה. הוא גם עוזר להדק את אזור הבטן ותומך בנשיפה חזקה.",
        "Helps twist your body to the same side, bend sideways, and bend forward. It also helps keep your core tight and supports strong breathing out.": "עוזר לסובב את הגוף לאותו צד, להתכופף הצידה ולהתכופף קדימה. הוא גם עוזר לשמור על ליבה יציבה ותומך בנשיפה חזקה.",
        "Moves and holds the shoulder blade in place. The upper part shrugs the shoulders up, the middle part pulls the shoulder blades back, and the lower part helps pull the shoulder blades down and helps lift the arm above the head.": "מניע ומייצב את השכמה. החלק העליון מרים את הכתפיים, החלק האמצעי מושך את השכמות לאחור, והחלק התחתון עוזר להוריד את השכמות ולהרים את היד מעל הראש.",
        "Lifts the shoulder blade upward, like when shrugging one shoulder. It also helps turn the shoulder blade downward and can help bend or extend the neck.": "מרים את השכמה כלפי מעלה, כמו במשיכת כתף אחת. הוא גם עוזר לסובב את השכמה כלפי מטה ויכול לעזור בכיפוף או יישור הצוואר.",
        "Pulls the shoulder blade back toward the spine. It also helps keep the shoulder blade flat against the ribs and supports posture during pulling movements.": "מושך את השכמה לאחור לכיוון עמוד השדרה. הוא גם עוזר לשמור את השכמה צמודה לצלעות ותומך ביציבה בזמן תנועות משיכה.",
        "Pulls the shoulder blade back and slightly downward. It helps keep the shoulder blade steady against the rib cage during rows, posture, and pulling exercises.": "מושך את השכמה לאחור וקצת כלפי מטה. הוא עוזר לייצב את השכמה מול כלוב הצלעות בזמן חתירות, יציבה ותרגילי משיכה.",
        "Pulls the arm down and back toward the body. It is used in pull-ups, rows, climbing, swimming movements, and any motion where you pull with your arm.": "מושך את היד למטה ולאחור לכיוון הגוף. הוא עובד במתח, חתירות, טיפוס, תנועות שחייה וכל תנועה שבה מושכים עם היד.",
        "Helps start lifting the arm out to the side. It also helps hold the upper arm bone securely in the shoulder joint.": "עוזר להתחיל להרים את היד הצידה. הוא גם עוזר להחזיק את עצם הזרוע יציבה בתוך מפרק הכתף.",
        "Pulls the arm backward and helps move it out to the side behind you. It is used in rear-delt raises, rows, and pulling the arm back.": "מושך את היד לאחור ועוזר להזיז אותה הצידה מאחורי הגוף. הוא עובד בהרמות דלתא אחורית, חתירות ומשיכת היד לאחור.",
        "Turns the upper arm outward. It also helps keep the shoulder joint stable while the arm moves.": "מסובב את הזרוע החוצה. הוא גם עוזר לשמור על יציבות מפרק הכתף בזמן שהיד זזה.",
        "Turns the upper arm outward and helps keep the shoulder stable. It works with the other rotator cuff muscles.": "מסובב את הזרוע החוצה ועוזר לשמור על יציבות הכתף. הוא עובד יחד עם שאר שרירי מסובבי הכתף.",
        "Pulls the arm down and back and turns it inward. It helps the lats during pulling movements.": "מושך את היד למטה ולאחור ומסובב אותה פנימה. הוא מסייע לרחב הגבי בתנועות משיכה.",
        "Turns the upper arm inward and helps keep the shoulder joint stable. It is one of the rotator cuff muscles.": "מסובב את הזרוע פנימה ועוזר לשמור על יציבות מפרק הכתף. זה אחד משרירי מסובבי הכתף.",
        "Helps straighten the spine close to the center of the back. It supports posture and controlled back extension.": "עוזר ליישר את עמוד השדרה קרוב למרכז הגב. הוא תומך ביציבה ובפשיטת גב מבוקרת.",
        "Helps straighten the spine and neck. It also helps bend the body sideways and keeps the back upright.": "עוזר ליישר את עמוד השדרה והצוואר. הוא גם עוזר לכופף את הגוף הצידה ושומר על גב זקוף.",
        "Helps straighten the back and bend the body sideways. It also helps you stay upright with good posture.": "עוזר ליישר את הגב ולכופף את הגוף הצידה. הוא גם עוזר לשמור על עמידה זקופה ויציבה טובה.",
        "Helps stabilize the small joints of the spine. It keeps the back steady and helps control small twisting and extending movements.": "עוזר לייצב את המפרקים הקטנים של עמוד השדרה. הוא שומר על גב יציב ועוזר לשלוט בתנועות סיבוב ופשיטה קטנות.",
        "Helps bend the body sideways, support the lower back, and lift one side of the pelvis. It also helps steady the lower ribs while breathing.": "עוזר לכופף את הגוף הצידה, לתמוך בגב התחתון ולהרים צד אחד של האגן. הוא גם עוזר לייצב את הצלעות התחתונות בזמן נשימה.",
        "Helps bring the upper arm forward and inward toward the body. It also helps keep the shoulder steady.": "עוזר להביא את הזרוע קדימה ופנימה לכיוון הגוף. הוא גם עוזר לשמור על יציבות הכתף.",
        "Helps bend the elbow and turn the palm upward. It also helps lift the arm forward and supports the shoulder because it crosses the shoulder joint.": "עוזר לכופף את המרפק ולסובב את כף היד כלפי מעלה. הוא גם עוזר להרים את היד קדימה ותומך בכתף כי הוא עובר דרך מפרק הכתף.",
        "Helps bend the elbow and turn the palm upward. It also helps bring the arm forward and slightly inward.": "עוזר לכופף את המרפק ולסובב את כף היד כלפי מעלה. הוא גם עוזר להביא את היד קדימה וקצת פנימה.",
        "Main muscle for bending the elbow. It works strongly no matter if the palm faces up, down, or sideways.": "השריר המרכזי לכיפוף המרפק. הוא עובד חזק בלי קשר אם כף היד פונה למעלה, למטה או הצידה.",
        "Helps bend the elbow best when the thumb is pointing upward, like a hammer curl. It also helps bring the forearm back toward a neutral position.": "עוזר לכופף את המרפק הכי טוב כשהאגודל פונה למעלה, כמו בכפיפת פטיש. הוא גם עוזר להחזיר את האמה למצב ניטרלי.",
        "Helps point the foot downward and helps bend the knee. It is used for jumping, sprinting, calf raises, and pushing off the ground.": "עוזר להצביע את כף הרגל מטה ולעזור בכיפוף הברך. הוא עובד בקפיצות, ספרינטים, הרמות תאומים ודחיפה מהקרקע.",
        "Helps point the foot downward and helps bend the knee. It works with the medial head for powerful pushing, running, jumping, and calf raises.": "עוזר להצביע את כף הרגל מטה ולעזור בכיפוף הברך. הוא עובד עם הראש הפנימי לדחיפה חזקה, ריצה, קפיצה והרמות תאומים.",
        "Helps point the foot downward, especially when the knee is bent. It is important for standing, balance, walking, and long-lasting calf strength.": "עוזר להצביע את כף הרגל מטה, במיוחד כשהברך כפופה. הוא חשוב לעמידה, שיווי משקל, הליכה וחוזק מתמשך בתאומים.",
        "Lifts the front of the foot upward and turns the foot slightly inward. It helps stop the foot from slapping the ground and helps clear the toes while walking.": "מרים את קדמת כף הרגל כלפי מעלה ומסובב אותה מעט פנימה. הוא עוזר למנוע מכף הרגל להיטרק על הקרקע ועוזר להרים את האצבעות בזמן הליכה.",
        "Helps unlock the knee when you begin bending it. It also helps stabilize the back and outside part of the knee.": "עוזר לשחרר את הברך כשמתחילים לכופף אותה. הוא גם עוזר לייצב את החלק האחורי והחיצוני של הברך.",
        "Points the foot downward, turns it inward, and supports the arch of the foot. It helps control the foot while walking or running.": "מצביע את כף הרגל מטה, מסובב אותה פנימה ותומך בקשת כף הרגל. הוא עוזר לשלוט בכף הרגל בזמן הליכה או ריצה.",
        "Bends the four smaller toes and helps point the foot downward. It helps grip the ground and supports push-off when walking.": "כופף את ארבע האצבעות הקטנות ועוזר להצביע את כף הרגל מטה. הוא עוזר לאחוז בקרקע ותומך בדחיפה בזמן הליכה.",
        "Bends the big toe and helps point the foot downward. It is important for the final push-off in walking, running, and jumping.": "כופף את הבוהן הגדולה ועוזר להצביע את כף הרגל מטה. הוא חשוב לדחיפה הסופית בהליכה, ריצה וקפיצה.",
        "Helps lift the arm forward and bring it across the body. It works a lot during incline pressing and front-raising movements.": "עוזר להרים את היד קדימה ולהביא אותה לרוחב הגוף. הוא עובד הרבה בלחיצות בשיפוע ובהרמות קדמיות.",
        "Helps bring the arm across the body, pull it inward, and turn it inward. It is used in pressing, hugging, and bringing the arm down from overhead.": "עוזר להביא את היד לרוחב הגוף, למשוך אותה פנימה ולסובב אותה פנימה. הוא עובד בלחיצות, חיבוק והורדת היד מלמעלה.",
        "Helps pull the arm downward and inward from a raised position. It is used during dips, decline presses, and lower-chest pressing movements.": "עוזר למשוך את היד מטה ופנימה ממצב מורם. הוא עובד במקבילים, לחיצות בשיפוע שלילי ותנועות לחיצה לחזה תחתון.",
        "Pulls the shoulder blade forward and downward. It helps hold the shoulder blade against the ribs and can help with deep breathing when the shoulders are fixed.": "מושך את השכמה קדימה ומטה. הוא עוזר להחזיק את השכמה צמודה לצלעות ויכול לעזור בנשימה עמוקה כשהכתפיים מקובעות.",
        "Helps hold the collarbone steady and pull it slightly downward. It supports the shoulder area during movement.": "עוזר לייצב את עצם הבריח ולמשוך אותה מעט מטה. הוא תומך באזור הכתף בזמן תנועה.",
        "Lifts the arm forward, turns it inward, and helps bring it across the body. It is used in pressing and front raises.": "מרים את היד קדימה, מסובב אותה פנימה ועוזר להביא אותה לרוחב הגוף. הוא עובד בלחיצות ובהרמות קדמיות.",
        "Turns the forearm so the palm faces down. It also helps bend the elbow a little.": "מסובב את האמה כך שכף היד פונה למטה. הוא גם עוזר לכופף מעט את המרפק.",
        "Bends the wrist and moves it toward the thumb side. It helps position the wrist during gripping and pressing.": "כופף את שורש כף היד ומזיז אותו לכיוון צד האגודל. הוא עוזר למקם את שורש כף היד בזמן אחיזה ולחיצה.",
        "Weakly bends the wrist and tightens the tissue in the palm. It helps support gripping.": "כופף חלש את שורש כף היד ומותח את הרקמה בכף היד. הוא עוזר לתמוך באחיזה.",
        "Bends the wrist and moves it toward the pinky side. It helps with grip strength and wrist control during pulling and lifting.": "כופף את שורש כף היד ומזיז אותו לכיוון הזרת. הוא עוזר בכוח אחיזה ובשליטה בשורש כף היד בזמן משיכה והרמה.",
        "Bends the middle joints of the fingers. It helps with gripping objects and making a fist.": "כופף את המפרקים האמצעיים של האצבעות. הוא עוזר לאחוז חפצים ולעשות אגרוף.",
        "Bends the thumb, especially the thumb tip. It helps with pinching, gripping, and fine hand control.": "כופף את האגודל, במיוחד את קצה האגודל. הוא עוזר בצביטה, אחיזה ושליטה עדינה ביד.",
        "Bends the fingertips of the fingers. It is very important for strong gripping and holding objects tightly.": "כופף את קצות האצבעות. הוא חשוב מאוד לאחיזה חזקה ולהחזקת חפצים בחוזקה.",
        "Turns the forearm so the palm faces down. It also helps keep the wrist-side forearm joint stable.": "מסובב את האמה כך שכף היד פונה למטה. הוא גם עוזר לשמור על יציבות מפרק האמה ליד שורש כף היד.",
        "Straightens the wrist and moves it toward the thumb side. It helps keep the wrist steady while gripping.": "מיישר את שורש כף היד ומזיז אותו לכיוון צד האגודל. הוא עוזר לשמור על שורש כף היד יציב בזמן אחיזה.",
        "Straightens the wrist and helps move it toward the thumb side. It keeps the wrist stable during gripping.": "מיישר את שורש כף היד ועוזר להזיז אותו לכיוון צד האגודל. הוא שומר על יציבות שורש כף היד בזמן אחיזה.",
        "Straightens the fingers and helps straighten the wrist. It lets you open the hand.": "מיישר את האצבעות ועוזר ליישר את שורש כף היד. הוא מאפשר לפתוח את היד.",
        "Straightens the little finger and helps straighten the wrist. It helps the pinky move more independently.": "מיישר את הזרת ועוזר ליישר את שורש כף היד. הוא עוזר לזרת לנוע בצורה עצמאית יותר.",
        "Straightens the wrist and moves it toward the pinky side. It helps stabilize the wrist during gripping.": "מיישר את שורש כף היד ומזיז אותו לכיוון הזרת. הוא עוזר לייצב את שורש כף היד בזמן אחיזה.",
        "Turns the forearm so the palm faces up. It works with the biceps when turning the hand upward.": "מסובב את האמה כך שכף היד פונה למעלה. הוא עובד עם היד הקדמית כשמסובבים את היד כלפי מעלה.",
        "Moves the thumb away from the hand and helps lift it. It also helps move the wrist toward the thumb side.": "מרחיק את האגודל מהיד ועוזר להרים אותו. הוא גם עוזר להזיז את שורש כף היד לכיוון צד האגודל.",
        "Straightens the thumb near the knuckle. It helps lift and open the thumb.": "מיישר את האגודל ליד המפרק. הוא עוזר להרים ולפתוח את האגודל.",
        "Straightens the thumb tip and helps open the thumb fully after gripping.": "מיישר את קצה האגודל ועוזר לפתוח את האגודל לגמרי אחרי אחיזה.",
        "Straightens the index finger and helps straighten the wrist. It lets the index finger extend more independently.": "מיישר את האצבע המורה ועוזר ליישר את שורש כף היד. הוא מאפשר לאצבע המורה להתיישר בצורה עצמאית יותר.",
        "Moves the leg out to the side and keeps the pelvis level when standing on one leg. It is important for walking, running, and hip stability.": "מזיז את הרגל הצידה ושומר על האגן מאוזן כשעומדים על רגל אחת. הוא חשוב להליכה, ריצה ויציבות ירך.",
        "Straightens the hip and moves the leg backward. It is used in squats, hip thrusts, standing up, climbing stairs, sprinting, and jumping.": "מיישר את הירך ומזיז את הרגל לאחור. הוא עובד בסקוואטים, היפ טראסט, קימה, עלייה במדרגות, ספרינטים וקפיצות.",
        "Moves the leg out to the side and helps turn the hip inward. It also keeps the pelvis steady while walking.": "מזיז את הרגל הצידה ועוזר לסובב את הירך פנימה. הוא גם שומר על יציבות האגן בזמן הליכה.",
        "Turns the hip outward and helps move the bent hip away from the body. It also helps keep the hip joint stable.": "מסובב את הירך החוצה ועוזר להרחיק ירך כפופה מהגוף. הוא גם עוזר לשמור על יציבות מפרק הירך.",
        "Helps turn the hip outward and move the bent hip away from the body. It works with the other deep hip rotators.": "עוזר לסובב את הירך החוצה ולהרחיק ירך כפופה מהגוף. הוא עובד עם שאר מסובבי הירך העמוקים.",
        "Turns the hip outward and helps move the bent hip away from the body. It helps keep the hip joint steady.": "מסובב את הירך החוצה ועוזר להרחיק ירך כפופה מהגוף. הוא עוזר לשמור על יציבות מפרק הירך.",
        "Helps turn the hip outward and move the bent hip away from the body. It supports deep hip stability.": "עוזר לסובב את הירך החוצה ולהרחיק ירך כפופה מהגוף. הוא תומך ביציבות עמוקה של הירך.",
        "Turns the hip outward and helps keep the top of the thigh bone stable in the hip socket.": "מסובב את הירך החוצה ועוזר לשמור על ראש עצם הירך יציב בתוך מפרק הירך.",
        "Turns the hip outward and helps bring the thigh inward. It also helps stabilize the back of the hip.": "מסובב את הירך החוצה ועוזר להביא את הירך פנימה. הוא גם עוזר לייצב את החלק האחורי של הירך.",
        "Helps move the thigh backward, bend the knee, and turn the bent knee outward. It is important for sprinting and hip extension strength.": "עוזר להזיז את הירך לאחור, לכופף את הברך ולסובב ברך כפופה החוצה. הוא חשוב לספרינטים ולכוח פשיטת ירך.",
        "Bends the knee and turns the bent knee outward. It works only at the knee, not the hip.": "כופף את הברך ומסובב ברך כפופה החוצה. הוא עובד רק בברך, לא בירך.",
        "Moves the thigh backward, bends the knee, and turns the bent knee inward. It helps control the back and inside of the thigh.": "מזיז את הירך לאחור, כופף את הברך ומסובב ברך כפופה פנימה. הוא עוזר לשלוט בחלק האחורי והפנימי של הירך.",
        "Moves the thigh backward, bends the knee, and turns the bent knee inward. It also helps stabilize the back and inside of the knee.": "מזיז את הירך לאחור, כופף את הברך ומסובב ברך כפופה פנימה. הוא גם עוזר לייצב את החלק האחורי והפנימי של הברך.",
        "Brings the thigh inward and helps lift it forward. It helps guide the leg during walking and controlled hip movement.": "מקרב את הירך פנימה ועוזר להרים אותה קדימה. הוא עוזר לכוון את הרגל בזמן הליכה ותנועת ירך מבוקרת.",
        "Brings the thigh inward and helps lift it forward. It is used when squeezing the legs together or controlling side-to-side movement.": "מקרב את הירך פנימה ועוזר להרים אותה קדימה. הוא עובד כשמצמידים רגליים או שולטים בתנועה מצד לצד.",
        "Brings the thigh inward and helps lift it forward. It supports hip control during walking and lower-body movement.": "מקרב את הירך פנימה ועוזר להרים אותה קדימה. הוא תומך בשליטה בירך בזמן הליכה ותנועות פלג גוף תחתון.",
        "Strongly brings the thigh inward. Part of it also helps move the thigh backward, making it important in squats, hip control, and powerful leg movement.": "מקרב את הירך פנימה בעוצמה. חלק ממנו גם עוזר להזיז את הירך לאחור, ולכן הוא חשוב בסקוואטים, שליטה בירך ותנועת רגל חזקה.",
        "Brings the thigh inward, bends the knee, and turns the bent knee inward. It helps control the inside of the thigh and knee.": "מקרב את הירך פנימה, כופף את הברך ומסובב ברך כפופה פנימה. הוא עוזר לשלוט בחלק הפנימי של הירך והברך.",
        "Straightens the knee and lifts the thigh forward. It works at both the hip and knee, so it is used in kicking, sprinting, and leg raises.": "מיישר את הברך ומרים את הירך קדימה. הוא עובד גם בירך וגם בברך, ולכן הוא משמש בבעיטות, ספרינטים והרמות רגליים.",
        "Straightens the knee and helps keep the kneecap stable from the outside. It is used in squats, leg presses, running, and jumping.": "מיישר את הברך ועוזר לשמור על פיקת הברך יציבה מהצד החיצוני. הוא עובד בסקוואטים, לחיצות רגליים, ריצה וקפיצה.",
        "Straightens the knee. It sits under the rectus femoris and helps produce strong knee extension.": "מיישר את הברך. הוא נמצא מתחת לישר הירכי ועוזר ליצור פשיטת ברך חזקה.",
        "Straightens the knee and helps guide the kneecap from the inside. It is important near the end of straightening the leg.": "מיישר את הברך ועוזר לכוון את פיקת הברך מהצד הפנימי. הוא חשוב לקראת סוף יישור הרגל.",
        "Pulls the knee joint lining upward when the knee straightens. This helps keep tissue from getting pinched inside the knee.": "מושך את מעטפת מפרק הברך כלפי מעלה כשהברך מתיישרת. זה עוזר למנוע מרקמות להיתפס בתוך הברך.",
        "Main muscle for lifting the thigh forward. It also helps support and move the lower back.": "השריר המרכזי להרמת הירך קדימה. הוא גם עוזר לתמוך ולהניע את הגב התחתון.",
        "Weakly helps bend the lower back and tighten tissue near the hip. It is small and not everyone has it.": "עוזר חלש בכיפוף הגב התחתון ובהידוק רקמה ליד הירך. הוא קטן ולא קיים אצל כולם.",
        "Lifts the thigh forward, moves it out to the side, and turns it inward. It also tightens the IT band and helps stabilize the hip and knee.": "מרים את הירך קדימה, מזיז אותה הצידה ומסובב אותה פנימה. הוא גם מותח את רצועת ה-IT ועוזר לייצב את הירך והברך.",
        "Helps lift the thigh, move it outward, turn it outward, and bend the knee. It is used in a cross-legged position.": "עוזר להרים את הירך, להזיז אותה החוצה, לסובב אותה החוצה ולכופף את הברך. הוא משמש בתנוחת ישיבה ברגליים משולבות.",
        "Lifts the arm out to the side. It is the main muscle used in lateral raises and helps create shoulder width.": "מרים את היד הצידה. זה השריר המרכזי בהרחקות כתפיים והוא עוזר ליצור רוחב כתפיים.",
        "Straightens the elbow and also helps move the upper arm backward and inward. It helps during pushing and overhead movements.": "מיישר את המרפק וגם עוזר להזיז את הזרוע לאחור ופנימה. הוא עוזר בתנועות דחיפה ותנועות מעל הראש.",
        "Straightens the elbow, especially during strong pushing or pressing movements.": "מיישר את המרפק, במיוחד בזמן תנועות דחיפה או לחיצה חזקות.",
        "Straightens the elbow during almost all pushing movements. It works even during lighter elbow extension.": "מיישר את המרפק כמעט בכל תנועות הדחיפה. הוא עובד גם בפשיטת מרפק קלה יותר.",
        "Helps straighten and stabilize the elbow. It supports the triceps during elbow extension.": "עוזר ליישר ולייצב את המרפק. הוא תומך ביד האחורית בזמן פשיטת מרפק.",
        "Shoulders": "כתפיים",
        "Shoulder": "כתף",
        "Biceps": "יד קדמית",
        "Forearms": "אמות",
        "Forearm": "אמה",
        "Abs": "בטן",
        "Chest": "חזה",
        "Back": "גב",
        "Triceps": "יד אחורית",
        "Quadriceps": "ארבע ראשי",
        "Glutes": "ישבן",
        "Hamstrings": "המסטרינגס",
        "Calves": "תאומים",
        "Shoulder Anatomy": "אנטומיית כתפיים",
        "Biceps Anatomy": "אנטומיית יד קדמית",
        "Forearm Anatomy": "אנטומיית אמות",
        "Abs Anatomy": "אנטומיית בטן",
        "Chest Anatomy": "אנטומיית חזה",
        "Back Anatomy": "אנטומיית גב",
        "Triceps Anatomy": "אנטומיית יד אחורית",
        "Quadriceps Anatomy": "אנטומיית ארבע ראשי",
        "Glutes Anatomy": "אנטומיית ישבן",
        "Hamstrings Anatomy": "אנטומיית המסטרינגס",
        "Calves Anatomy": "אנטומיית תאומים",
        "Shoulders muscle groups": "קבוצות שרירי כתפיים",
        "Biceps muscle groups": "קבוצות שרירי יד קדמית",
        "Forearms muscle groups": "קבוצות שרירי אמות",
        "Abs muscle groups": "קבוצות שרירי בטן",
        "Chest muscle groups": "קבוצות שרירי חזה",
        "Back muscle groups": "קבוצות שרירי גב",
        "Triceps muscle groups": "קבוצות שרירי יד אחורית",
        "Quadriceps muscle groups": "קבוצות שרירי ארבע ראשי",
        "Glutes muscle groups": "קבוצות שרירי ישבן",
        "Hamstrings muscle groups": "קבוצות שרירי המסטרינגס",
        "Calves muscle groups": "קבוצות שרירי תאומים",
        "Diet": "תזונה",
        "Diet stats": "סטטיסטיקות תזונה",
        "My foods": "המאכלים שלי",
        "Settings": "הגדרות",
        "Workouts": "אימונים",
        "Workout Plan": "תוכנית אימון",
        "Workout planner": "מתכנן אימונים",
        "Workout builder": "בניית אימון",
        "Saved plans": "תוכניות שמורות",
        "Saved workouts": "אימונים שמורים",
        "Exercises": "תרגילים",
        "Exercises guide": "מדריך תרגילים",
        "Training guide": "מדריך אימונים",
        "Information": "מידע",
        "Anatomy": "אנטומיה",
        "Researches": "מחקרים",
        "Progressive overload": "עומס מתקדם",
        "Favorites": "מועדפים",
        "Weights tracking": "מעקב משקלים",
        "Account options": "אפשרויות חשבון",
        "Appearance": "מראה",
        "Use dark mode colors across the app.": "השתמש בצבעי מצב כהה בכל האפליקציה.",
        "Choose what you want to do on this device.": "בחר מה לעשות במכשיר הזה.",
        "Dark mode": "מצב כהה",
        "Language": "שפה",
        "Open language menu": "פתח תפריט שפה",
        "Select": "בחר",
        "Selected": "נבחר",
        "Open": "פתח",
        "Exercise name": "שם תרגיל",
        "Set": "סט",
        "weight": "משקל",
        "reps": "חזרות",
        "Add Set": "הוסף סט",
        "Delete set": "מחק סט",
        "Choose the language used across GYMRAT.": "בחר את השפה שתופיע בכל GYMRAT.",
        "English": "English",
        "Hebrew": "עברית",
        "Change username": "שינוי שם משתמש",
        "Choose the name shown inside GYMRAT.": "בחר את השם שיופיע בתוך GYMRAT.",
        "New username": "שם משתמש חדש",
        "Save": "שמור",
        "Change account": "החלף חשבון",
        "Log out": "התנתק",
        "Forget this device": "שכח את המכשיר הזה",
        "Delete account": "מחק חשבון",
        "Terms of Use": "תנאי שימוש",
        "Close": "סגור",
        "Close settings": "סגור הגדרות",
        "Login": "התחברות",
        "Log in": "התחבר",
        "Register": "הרשמה",
        "Sign in": "התחברות",
        "Sign up": "הרשמה",
        "Continue with Google": "המשך עם Google",
        "Register with Google": "הרשמה עם Google",
        "Login with Google": "התחברות עם Google",
        "Create account": "צור חשבון",
        "Username": "שם משתמש",
        "Password": "סיסמה",
        "I accept the Terms of Use": "אני מאשר את תנאי השימוש",
        "Choose a username": "בחר שם משתמש",
        "Daily Nutrition": "תזונה יומית",
        "Diet system": "מערכת תזונה",
        "Add food": "הוסף מאכל",
        "Add Food": "הוסף מאכל",
        "Find or Scan Food": "חיפוש או סריקת מאכל",
        "Search food": "חיפוש מאכל",
        "Search saved foods": "חיפוש מאכלים שמורים",
        "Start typing a food name, then choose one result to set the amount.": "התחל להקליד שם מאכל, ואז בחר תוצאה אחת כדי לקבוע כמות.",
        "Downloading food values...": "מוריד ערכי תזונה...",
        "No matching foods yet": "עדיין אין מאכלים מתאימים",
        "Food values could not load. Check your connection.": "ערכי התזונה לא נטענו. בדוק את החיבור.",
        "Food name": "שם מאכל",
        "Calories": "קלוריות",
        "Protein": "חלבון",
        "Carbs": "פחמימות",
        "Fat": "שומן",
        "Serving": "מנה",
        "Grams": "גרמים",
        "Tablespoons": "כפות",
        "Cups": "כוסות",
        "Amount": "כמות",
        "Min": "מינימום",
        "Max": "מקסימום",
        "Jumbo egg": "ביצת ג׳מבו",
        "Daily summary": "סיכום יומי",
        "Logged foods": "מאכלים שנרשמו",
        "Main navigation": "ניווט ראשי",
        "Mobile quick navigation": "ניווט מהיר במובייל",
        "Open menu": "פתח תפריט",
        "Close menu": "סגור תפריט",
        "Menu": "תפריט",
        "Close": "סגור",
        "Log food": "רשום מאכל",
        "Log Food": "רישום אוכל",
        "Add or update a day": "הוסף או עדכן יום",
        "Find or scan food": "חפש או סרוק מאכל",
        "Add manual item": "הוסף פריט ידני",
        "Remove day": "מחק יום",
        "Food log": "יומן אוכל",
        "Edit diet setup": "ערוך הגדרת תזונה",
        "Track calories, macros, and daily progress inside GYMRAT.": "עקוב אחרי קלוריות, מאקרו והתקדמות יומית בתוך GYMRAT.",
        "Save to my foods": "שמור למאכלים שלי",
        "Discard": "בטל",
        "Discard result": "בטל תוצאה",
        "Back to diet": "חזרה לתזונה",
        "Product barcode": "ברקוד מוצר",
        "Packaged food": "מאכל ארוז",
        "Scan or enter a barcode": "סרוק או הקלד ברקוד",
        "Search saved foods or scan a product barcode, then log the serving you ate.": "חפש מאכלים שמורים או סרוק ברקוד מוצר, ואז רשום את המנה שאכלת.",
        "Finds product macros from Open Food Facts when data is available.": "מוצא ערכי מאקרו של מוצר מ-Open Food Facts כשהנתונים זמינים.",
        "Enter barcode": "הקלד ברקוד",
        "Food search": "חיפוש מאכל",
        "Search rice, egg, banana, chicken...": "חפש אורז, ביצה, בננה, עוף...",
        "Choose a food, then log it by grams, tablespoons, cups, or egg size.": "בחר מאכל, ואז רשום אותו לפי גרמים, כפות, כוסות או גודל ביצה.",
        "Close food search": "סגור חיפוש מאכל",
        "Selected food": "מאכל נבחר",
        "Per 100g": "ל-100 גרם",
        "Close selected food": "סגור מאכל נבחר",
        "Selected food macros": "מאקרו של המאכל הנבחר",
        "Egg size": "גודל ביצה",
        "Small egg": "ביצה קטנה",
        "Medium egg": "ביצה בינונית",
        "Large egg": "ביצה גדולה",
        "Extra large egg": "ביצה גדולה מאוד",
        "Log product": "רשום מוצר",
        "Example: Protein yogurt": "לדוגמה: יוגורט חלבון",
        "Barcode nutrition lookup": "חיפוש ערכי תזונה לפי ברקוד",
        "Barcode lookup:": "חיפוש ברקוד:",
        "Barcode product": "מוצר ברקוד",
        "Open camera": "פתח מצלמה",
        "Close camera": "סגור מצלמה",
        "Read barcode": "קרא ברקוד",
        "Barcode number": "מספר ברקוד",
        "Search barcode": "חפש ברקוד",
        "Enter or scan a barcode first.": "הקלד או סרוק ברקוד קודם.",
        "Looking up barcode...": "מחפש ברקוד...",
        "Reading barcode... keep it flat, bright, and inside the camera view.": "קורא ברקוד... החזק אותו ישר, מואר ובתוך תמונת המצלמה.",
        "No barcode found. Hold the barcode closer, make it fill most of the view, avoid glare, then tap Read barcode again.": "לא נמצא ברקוד. קרב אותו למצלמה, מלא איתו את רוב התמונה, הימנע מסנוור ולחץ שוב על קרא ברקוד.",
        "Camera is not supported in this browser. Type the barcode number instead.": "המצלמה לא נתמכת בדפדפן הזה. הקלד את מספר הברקוד במקום.",
        "Barcode reader is still loading. Wait a moment, or type the number and tap Search barcode.": "קורא הברקוד עדיין נטען. המתן רגע, או הקלד את המספר ולחץ על חפש ברקוד.",
        "Tap Read barcode when the barcode is clear.": "לחץ על קרא ברקוד כשהברקוד ברור.",
        "Barcode reader is still loading. You can type the number and tap Search barcode.": "קורא הברקוד עדיין נטען. אפשר להקליד את המספר וללחוץ על חפש ברקוד.",
        "Product not found in Open Food Facts.": "המוצר לא נמצא ב-Open Food Facts.",
        "Source: Open Food Facts": "מקור: Open Food Facts",
        "Barcode lookup failed.": "חיפוש הברקוד נכשל.",
        "Could not open barcode scanner.": "לא ניתן לפתוח את סורק הברקוד.",
        "Could not open barcode scanner. Type the barcode number instead.": "לא ניתן לפתוח את סורק הברקוד. הקלד את מספר הברקוד במקום.",
        "Camera open. Place the barcode inside the view.": "המצלמה פתוחה. מקם את הברקוד בתוך התצוגה.",
        "Camera open. Place the barcode inside the view. Tap Read barcode when the barcode is clear.": "המצלמה פתוחה. מקם את הברקוד בתוך התצוגה. לחץ על קרא ברקוד כשהברקוד ברור.",
        "Camera open. Place the barcode inside the view. Barcode Detection is not supported in this browser. Type the number or use a browser with Barcode Detection.": "המצלמה פתוחה. מקם את הברקוד בתוך התצוגה. זיהוי ברקוד לא נתמך בדפדפן הזה. הקלד את המספר או השתמש בדפדפן שתומך בזיהוי ברקוד.",
        "Barcode camera is not ready yet.": "מצלמת הברקוד עדיין לא מוכנה.",
        "Barcode scan failed.": "סריקת הברקוד נכשלה.",
        "Product found. Check the values, then log it.": "המוצר נמצא. בדוק את הערכים ואז רשום אותו.",
        "Product found, but some nutrition values are missing. Check the values before logging.": "המוצר נמצא, אבל חלק מערכי התזונה חסרים. בדוק את הערכים לפני הרישום.",
        "Camera needs HTTPS. Open the deployed website, then try again.": "המצלמה דורשת HTTPS. פתח את האתר שפורסם ואז נסה שוב.",
        "AI estimate saved to account": "הערכת AI נשמרה בחשבון",
        "Checking...": "בודק...",
        "No account is logged in.": "אין חשבון מחובר.",
        "You must be online to change username.": "צריך להיות מחובר לאינטרנט כדי לשנות שם משתמש.",
        "Enter a new username.": "הכנס שם משתמש חדש.",
        "Manual row added": "נוספה שורה ידנית",
        "Activity level": "רמת פעילות",
        "Choose activity level": "בחר רמת פעילות",
        "Inactive / inconsistent": "לא פעיל / לא עקבי",
        "Consistent": "עקבי",
        "Very active": "פעיל מאוד",
        "Ultra endurance athlete": "ספורטאי סיבולת קיצונית",
        "Goal": "מטרה",
        "Choose goal": "בחר מטרה",
        "Gain muscle": "עלייה במסת שריר",
        "Gain muscle + lose fat": "עלייה במסת שריר + ירידה בשומן",
        "Maintain": "שימור",
        "Continue": "המשך",
        "Inactive": "לא פעיל",
        "Gain muscles": "עלייה במסת שריר",
        "Lose fat": "ירידה בשומן",
        "Maintain weight": "שמירה על משקל",
        "Male": "זכר",
        "Female": "נקבה",
        "Age": "גיל",
        "Height": "גובה",
        "Weight": "משקל",
        "Body fat": "אחוז שומן",
        "Search": "חיפוש",
        "Clear": "נקה",
        "Delete": "מחק",
        "Edit": "ערוך",
        "Cancel": "בטל",
        "Done": "סיום",
        "Today": "היום",
        "Yesterday": "אתמול",
        "Custom": "מותאם אישית",
        "Back": "גב",
        "Next": "הבא",
        "Previous": "הקודם",
        "GYMRAT": "GYMRAT",
        "GYMRAT Logo": "לוגו GYMRAT",
        "Google account": "חשבון Google",
        "Choose account": "בחר חשבון",
        "GYMRAT - Choose Account": "GYMRAT - בחירת חשבון",
        "Select the GYMRAT account you want to open.": "בחר את חשבון GYMRAT שברצונך לפתוח.",
        "Loading your GYMRAT accounts...": "טוען את חשבונות GYMRAT שלך...",
        "Use another Google account": "השתמש בחשבון Google אחר",
        "No GYMRAT profiles are connected to this Google account yet. Register first.": "עדיין אין פרופילים של GYMRAT שמחוברים לחשבון Google הזה. הירשם קודם.",
        "Opening account...": "פותח חשבון...",
        "Sign in with Google first.": "התחבר עם Google קודם.",
        "Could not load accounts.": "לא ניתן לטעון חשבונות.",
        "GYMRAT - Login": "GYMRAT - התחברות",
        "GYMRAT - Terms of Use": "GYMRAT - תנאי שימוש",
        "Back to Login": "חזרה להתחברות",
        "GYMRAT Account": "חשבון GYMRAT",
        "Last updated: May 5, 2026": "עודכן לאחרונה: 5 במאי 2026",
        "Security Note": "הערת אבטחה",
        "GYMRAT uses account protection, but please do not enter important private information here.": "GYMRAT משתמשת בהגנה על חשבון, אבל אל תכניס כאן מידע פרטי חשוב.",
        "Use your own Google account and keep your Google account secure.": "השתמש בחשבון Google האישי שלך ושמור עליו מאובטח.",
        "We do not take responsibility for data that is stolen, lost, or accessed by someone else.": "אנחנו לא לוקחים אחריות על מידע שנגנב, אבד או שמישהו אחר ניגש אליו.",
        "Install GYMRAT": "התקן את GYMRAT",
        "Android App": "אפליקציית Android",
        "Add it to your phone and use it offline": "הוסף אותה לטלפון והשתמש בה גם בלי אינטרנט",
        "iPhone App": "אפליקציית iPhone",
        "iPhone Install Info": "מידע התקנה ל-iPhone",
        "Use Safari to add it to your Home Screen": "השתמש ב-Safari כדי להוסיף אותה למסך הבית",
        "Desktop App": "אפליקציית מחשב",
        "Windows App": "אפליקציית Windows",
        "Linux App": "אפליקציית Linux",
        "Mac App": "אפליקציית Mac",
        "ChromeOS App": "אפליקציית ChromeOS",
        "Install GYMRAT on Desktop": "התקן את GYMRAT על המחשב",
        "Install GYMRAT on Windows": "התקן את GYMRAT על Windows",
        "Install GYMRAT on Linux": "התקן את GYMRAT על Linux",
        "Install GYMRAT on Mac": "התקן את GYMRAT על Mac",
        "Install GYMRAT on ChromeOS": "התקן את GYMRAT על ChromeOS",
        "Use Chrome or Edge to install it like an app": "השתמש ב-Chrome או Edge כדי להתקין אותה כמו אפליקציה",
        "Close Android install guide": "סגור מדריך התקנה ל-Android",
        "Android Install": "התקנה ל-Android",
        "Install GYMRAT on Android": "התקן את GYMRAT על Android",
        "Chrome can install this website as an Android app. It opens from your Home Screen and can keep working offline after it is cached.": "Chrome יכול להתקין את האתר הזה כאפליקציית Android. היא נפתחת ממסך הבית ויכולה להמשיך לעבוד בלי אינטרנט אחרי שהאתר נשמר במטמון.",
        "Install": "התקן",
        "Open this website in Chrome on Android.": "פתח את האתר הזה ב-Chrome ב-Android.",
        "Tap the browser menu.": "לחץ על תפריט הדפדפן.",
        "Tap Install app or Add to Home screen.": "לחץ על התקן אפליקציה או הוסף למסך הבית.",
        "Close iPhone install guide": "סגור מדריך התקנה ל-iPhone",
        "iPhone Install": "התקנה ל-iPhone",
        "Install GYMRAT on iPhone": "התקן את GYMRAT על iPhone",
        "Open this website in Safari or Chrome, tap Share, then tap Add to Home Screen. If you do not see it right away, tap More or View More and choose Add to Home Screen there.": "פתח את האתר ב-Safari או Chrome, לחץ על שיתוף ואז על הוסף למסך הבית. אם זה לא מופיע מיד, לחץ על עוד או הצג עוד ובחר שם הוסף למסך הבית.",
        "Copy Link": "העתק קישור",
        "Website link copied.": "קישור האתר הועתק.",
        "Close PC install guide": "סגור מדריך התקנה למחשב",
        "Desktop Install": "התקנה למחשב",
        "Windows Install": "התקנה ל-Windows",
        "Linux Install": "התקנה ל-Linux",
        "Mac Install": "התקנה ל-Mac",
        "ChromeOS Install": "התקנה ל-ChromeOS",
        "Attention, you are about to install GYMRAT on this desktop": "שים לב, אתה עומד להתקין את GYMRAT על המחשב הזה",
        "Attention, you are about to install GYMRAT on this Windows": "שים לב, אתה עומד להתקין את GYMRAT על Windows",
        "Attention, you are about to install GYMRAT on this Linux": "שים לב, אתה עומד להתקין את GYMRAT על Linux",
        "Attention, you are about to install GYMRAT on this Mac": "שים לב, אתה עומד להתקין את GYMRAT על Mac",
        "Attention, you are about to install GYMRAT on this ChromeOS": "שים לב, אתה עומד להתקין את GYMRAT על ChromeOS",
        "Chrome or Edge can install this website as an app on your computer. If the browser install popup is not available, you will see the manual steps.": "Chrome או Edge יכולים להתקין את האתר הזה כאפליקציה במחשב. אם חלון ההתקנה של הדפדפן לא זמין, יוצגו שלבי התקנה ידניים.",
        "Open this website in Chrome or Edge.": "פתח את האתר הזה ב-Chrome או Edge.",
        "Click the install icon in the address bar or browser menu.": "לחץ על סמל ההתקנה בשורת הכתובת או בתפריט הדפדפן.",
        "Click Install.": "לחץ על התקן.",
        "Sign in with Google": "התחבר עם Google",
        "Choose your Google account to sign in.": "בחר את חשבון Google שלך כדי להתחבר.",
        "Don't have an account?": "אין לך חשבון?",
        "Already have account?": "כבר יש לך חשבון?",
        "Get started free": "התחל בחינם",
        "Create your GYMRAT account": "צור את חשבון GYMRAT שלך",
        "Create workout plans, explore body anatomy, save your training tools, and keep using GYMRAT offline after setup.": "צור תוכניות אימון, למד אנטומיה של הגוף, שמור את כלי האימון שלך והמשך להשתמש ב-GYMRAT גם בלי אינטרנט אחרי ההגדרה.",
        "Username*": "שם משתמש*",
        "I accept the": "אני מאשר את",
        "Already have account?": "כבר יש לך חשבון?",
        "Choose your Google account, then choose your username.": "בחר את חשבון Google שלך, ואז בחר שם משתמש.",
        "Change": "שנה",
        "Registering...": "נרשם...",
        "Choose your Google account first.": "בחר קודם את חשבון Google שלך.",
        "Choose your Google account first, then choose your username.": "בחר קודם את חשבון Google שלך, ואז בחר שם משתמש.",
        "Google account selected. Choose a username, accept the terms, and create your account.": "חשבון Google נבחר. בחר שם משתמש, אשר את התנאים וצור את החשבון.",
        "Please agree before creating an account.": "אשר את התנאים לפני יצירת חשבון.",
        "Registered successfully. Opening your account...": "נרשמת בהצלחה. פותח את החשבון שלך...",
        "Google sign in was cancelled or failed.": "ההתחברות עם Google בוטלה או נכשלה.",
        "Choose a Google account to sign in.": "בחר חשבון Google כדי להתחבר.",
        "Signing in with Google...": "מתחבר עם Google...",
        "Google sign in failed.": "ההתחברות עם Google נכשלה.",
        "Google registration failed. Try again.": "ההרשמה עם Google נכשלה. נסה שוב.",
        "Use Google to sign in.": "השתמש ב-Google כדי להתחבר.",
        "Account could not be opened.": "לא ניתן לפתוח את החשבון.",
        "Registered, but the new session could not be opened. Please sign in with Google.": "נרשמת, אבל לא ניתן לפתוח את ההפעלה החדשה. התחבר עם Google.",
        "Request failed": "הבקשה נכשלה",
        "Could not open account.": "לא ניתן לפתוח את החשבון.",
        "Google sign in failed. Try again.": "ההתחברות עם Google נכשלה. נסה שוב.",
        "Google sign in needs internet connection.": "התחברות עם Google דורשת חיבור לאינטרנט.",
        "Google sign in is still loading. Try again in a moment.": "ההתחברות עם Google עדיין נטענת. נסה שוב בעוד רגע.",
        "Google sign in is not configured yet. Add GOOGLE_CLIENT_ID in Vercel first.": "ההתחברות עם Google עדיין לא מוגדרת. הוסף קודם GOOGLE_CLIENT_ID ב-Vercel.",
        "Google sign in setup failed:": "הגדרת ההתחברות עם Google נכשלה:",
        "Username changed.": "שם המשתמש שונה.",
        "Researches are still in process.": "המחקרים עדיין בתהליך.",
        "Enter a food name before saving it to My foods.": "הכנס שם מאכל לפני שמירה במאכלים שלי.",
        "Product added to your daily log.": "המוצר נוסף ליומן היומי שלך.",
        "Food added to your daily log.": "המאכל נוסף ליומן היומי שלך.",
        "You can only edit today and yesterday.": "אפשר לערוך רק את היום ואתמול.",
        "Are you sure you want to bring this note back to a table? Data that was written in here before will not be saved.": "האם אתה בטוח שברצונך להחזיר את ההערה הזאת לטבלה? נתונים שנכתבו כאן קודם לא יישמרו.",
        "Are you sure you want to make this table a note? Data that was written in here before will not be saved.": "האם אתה בטוח שברצונך להפוך את הטבלה הזאת להערה? נתונים שנכתבו כאן קודם לא יישמרו.",
        "Are you sure you want to edit the table?": "האם אתה בטוח שברצונך לערוך את הטבלה?",
        "Are you sure you want to edit?": "האם אתה בטוח שברצונך לערוך?",
        "Are you sure you want to edit this plan?": "האם אתה בטוח שברצונך לערוך את התוכנית הזאת?",
        "No saved plans yet.": "עדיין אין תוכניות שמורות.",
        "Please enter a valid name for the note before saving.": "הכנס שם תקין להערה לפני השמירה.",
        "Please enter a valid name for the table before saving.": "הכנס שם תקין לטבלה לפני השמירה.",
        "Error: Name cell not found": "שגיאה: תא השם לא נמצא",
        "Saved successfully.": "נשמר בהצלחה.",
        "Edit Plan": "ערוך תוכנית",
        "Save & Close": "שמור וסגור",
        "row": "שורה",
        "col": "עמודה",
        "X row": "מחק שורה",
        "X col": "מחק עמודה",
        "+ row": "הוסף שורה",
        "+ col": "הוסף עמודה",
        "You are not logged in": "אתה לא מחובר",
        "No user logged in": "אין משתמש מחובר",
        "Please log in first": "התחבר קודם",
        "Unable to update favorites.": "לא ניתן לעדכן מועדפים.",
        "Are you sure you want to delete the selected items?": "האם אתה בטוח שברצונך למחוק את הפריטים שנבחרו?",
        "Are you sure you want to log out?": "האם אתה בטוח שברצונך להתנתק?",
        "Forget the saved login on this device? You can still log in again later.": "לשכוח את ההתחברות השמורה במכשיר הזה? עדיין תוכל להתחבר שוב מאוחר יותר.",
        "Delete this account and its cloud data? This cannot be undone.": "למחוק את החשבון הזה ואת נתוני הענן שלו? אי אפשר לבטל את הפעולה.",
        "Are you completely sure you want to delete this account?": "האם אתה בטוח לחלוטין שברצונך למחוק את החשבון הזה?",
        "You must be online to delete your account.": "צריך להיות מחובר לאינטרנט כדי למחוק את החשבון.",
        "Password changes are handled by your Google account.": "שינויי סיסמה מתבצעים דרך חשבון Google שלך.",
        "Notice": "הודעה",
        "Please Confirm": "אישור פעולה",
        "OK": "אישור",
        "Some diet stats are over 12 months old. Download reports you want now. Once your diet history reaches 14 months, the old year is deleted automatically and the most recent 2 months stay saved.": "חלק מנתוני התזונה ישנים מ-12 חודשים. הורד עכשיו דוחות שתרצה לשמור. כשהיסטוריית התזונה תגיע ל-14 חודשים, השנה הישנה תימחק אוטומטית ו-2 החודשים האחרונים יישארו שמורים.",
        "Diet stats warning": "אזהרת סטטיסטיקות תזונה",
        "Do not show this again for this year": "אל תציג זאת שוב השנה",
        "Write what you ate first.": "כתוב קודם מה אכלת.",
        "AI estimate needs internet connection.": "הערכת AI דורשת חיבור לאינטרנט.",
        "Account session is not ready. Please refresh and try again.": "הפעלת החשבון עדיין לא מוכנה. רענן ונסה שוב.",
        "AI estimate failed.": "הערכת AI נכשלה.",
        "Estimating...": "מעריך...",
        "Estimating with AI...": "מעריך עם AI...",
        "AI estimate added to today.": "הערכת AI נוספה להיום.",
        "Enter a food name before logging this product.": "הכנס שם מאכל לפני רישום המוצר הזה.",
        "Food values download failed.": "הורדת ערכי התזונה נכשלה.",
        "No foods logged yet.": "עדיין לא נרשמו מאכלים.",
        "Item name": "שם פריט",
        "Fats": "שומנים",
        "Remove": "הסר",
        "Remove item": "הסר פריט",
        "item": "פריט",
        "items": "פריטים",
        "goal": "יעד",
        "from per-100g macros": "לפי ערכים ל-100 גרם",
        "By egg size": "לפי גודל ביצה",
        "Per 100g macros": "ערכים ל-100 גרם",
        "Delete saved food": "מחק מאכל שמור",
        "Delete saved": "מחק שמור",
        "Calculated nutrition": "ערכים מחושבים",
        "kcal": "קלוריות",
        "protein": "חלבון",
        "carbs": "פחמימות",
        "fat": "שומן",
        "Reached goal": "היעד הושג",
        "Missed goal": "היעד לא הושג",
        "Total calories:": "סך קלוריות:",
        "Total fat:": "סך שומן:",
        "Standalone GYMRAT diet stats report": "דוח סטטיסטיקות תזונה עצמאי של GYMRAT",
        "Date": "תאריך",
        "Kcal +/-": "קלוריות +/-",
        "Fat kg": "קג שומן",
        "Download HTML report": "הורד דוח HTML",
        "Download report": "הורדת דוח",
        "Month or year HTML": "HTML חודשי או שנתי",
        "Report": "דוח",
        "Month": "חודש",
        "Year": "שנה",
        "Start month": "חודש התחלה",
        "End month": "חודש סיום",
        "Last 7 completed days are shown here. Month and year reports download as standalone HTML files.": "7 הימים המלאים האחרונים מוצגים כאן. דוחות חודש ושנה יורדים כקבצי HTML עצמאיים.",
        "Last 7 completed days": "7 הימים המלאים האחרונים",
        "Goal results": "תוצאות יעדים",
        "When diet history reaches 14 months, the old year is automatically removed and the most recent 2 months stay saved. Download reports before they expire.": "כשהיסטוריית התזונה מגיעה ל-14 חודשים, השנה הישנה נמחקת אוטומטית ו-2 החודשים האחרונים נשארים שמורים. הורד דוחות לפני שהם פגים.",
        "Saved foods": "מאכלים שמורים",
        "My Foods": "המאכלים שלי",
        "Choose one of your saved foods, set the serving, and log it to today.": "בחר אחד מהמאכלים השמורים שלך, קבע מנה ורשום אותו להיום.",
        "No saved foods yet. Save foods from search or barcode first.": "עדיין אין מאכלים שמורים. שמור קודם מאכלים מחיפוש או מברקוד.",
        "My saved foods": "המאכלים השמורים שלי",
        "Diet Setup": "הגדרת תזונה",
        "Open tracker": "פתח מעקב",
        "Nutrition targets": "יעדי תזונה",
        "Closest estimate possible without lab equipment. Accuracy depends on the details you enter.": "ההערכה הקרובה ביותר בלי ציוד מעבדה. הדיוק תלוי בפרטים שתכניס.",
        "Weight kg": "משקל קג",
        "Height cm": "גובה סמ",
        "Body fat %": "אחוז שומן %",
        "Open body fat percentage visual guide": "פתח מדריך חזותי לאחוז שומן",
        "Not sure? click here": "לא בטוח? לחץ כאן",
        "Calculate recommendations": "חשב המלצות",
        "Recommendation summary": "סיכום המלצה",
        "estimated burn": "שריפה משוערת",
        "Lean mass": "מסה רזה",
        "body mass": "מסת גוף",
        "Calories range": "טווח קלוריות",
        "Protein range g": "טווח חלבון בגרמים",
        "Carbs range g": "טווח פחמימות בגרמים",
        "Fat range g": "טווח שומן בגרמים",
        "Recommended ranges": "טווחים מומלצים",
        "Calculate to see recommendation": "חשב כדי לראות המלצה",
        "Calculate to see range": "חשב כדי לראות טווח",
        "Apply recommendations": "החל המלצות",
        "Save and open Diet": "שמור ופתח תזונה",
        "Reset setup": "אפס הגדרה",
        "Body fat reference images": "תמונות עזר לאחוז שומן",
        "Body Fat Estimate": "הערכת אחוז שומן",
        "Use these only as visual indicators": "השתמש בזה רק כאינדיקציה חזותית",
        "Look at the closest example, then enter your own body fat percentage in the setup form.": "הסתכל על הדוגמה הקרובה ביותר, ואז הכנס את אחוז השומן שלך בטופס ההגדרה.",
        "Close body fat guide": "סגור מדריך אחוז שומן",
        "Male body fat percent": "אחוז שומן לגברים",
        "Female body fat percent": "אחוז שומן לנשים",
        "Image did not load. The male reference file is missing.": "התמונה לא נטענה. קובץ העזר לגברים חסר.",
        "Image did not load. The female reference file is missing.": "התמונה לא נטענה. קובץ העזר לנשים חסר.",
        "Confirm reset": "אישור איפוס",
        "Reset diet setup?": "לאפס הגדרת תזונה?",
        "This clears the setup form and recommendation values on this screen.": "זה מנקה את טופס ההגדרה ואת ערכי ההמלצה במסך הזה.",
        "Yes": "כן",
        "No": "לא",
        "Fill weight, height, body fat, activity, and goal first": "מלא קודם משקל, גובה, אחוז שומן, רמת פעילות ומטרה",
        "Recommendations calculated. Apply them or enter your own ranges before saving.": "ההמלצות חושבו. החל אותן או הכנס טווחים משלך לפני שמירה.",
        "Recommended ranges applied. You can save or edit them manually.": "הטווחים המומלצים הוחלו. אפשר לשמור או לערוך אותם ידנית.",
        "Saved to account": "נשמר בחשבון",
        "Saved on this device": "נשמר במכשיר הזה",
        "Using saved device data": "משתמש בנתוני המכשיר השמורים",
        "Are you sure you want to reset your diet setup?": "האם אתה בטוח שברצונך לאפס את הגדרת התזונה?",
        "Setup reset": "ההגדרה אופסה",
        "Recalculate recommendations after changing details": "חשב מחדש המלצות אחרי שינוי הפרטים",
        "Fill every setup field before continuing": "מלא כל שדה הגדרה לפני שממשיכים",
        "Choose min and max ranges for calories, protein, carbs, and fat before continuing": "בחר טווחי מינימום ומקסימום לקלוריות, חלבון, פחמימות ושומן לפני שממשיכים",
        "A few months": "כמה חודשים",
        "Afternoon": "אחר הצהריים",
        "Back to Weekly Workout Routine": "חזרה לשגרת אימון שבועית",
        "Build your weekly routine in a clean table, edit days fast, and keep the whole split organized.": "בנה את השגרה השבועית שלך בטבלה נקייה, ערוך ימים במהירות ושמור על כל החלוקה מסודרת.",
        "Calories, macros, daily targets, food logs, barcode search, saved foods, and progress stats built around your body data and goal.": "קלוריות, מאקרו, יעדים יומיים, יומני אוכל, חיפוש ברקוד, מאכלים שמורים וסטטיסטיקות התקדמות לפי נתוני הגוף והמטרה שלך.",
        "Calories:": "קלוריות:",
        "Carbs:": "פחמימות:",
        "Choose a muscle group and jump into a sharper exercise overview built for quick decisions during your workout.": "בחר קבוצת שרירים ועבור לסקירת תרגילים ברורה שמיועדת להחלטות מהירות בזמן האימון.",
        "Create and edit workouts easily": "צור וערוך אימונים בקלות",
        "Create or view your own planner": "צור או צפה במתכנן שלך",
        "Date selection": "בחירת תאריך",
        "Diet Stats": "סטטיסטיקות תזונה",
        "Enter Name": "הכנס שם",
        "Enter workout name here": "הכנס כאן שם אימון",
        "Evening": "ערב",
        "Exercise": "תרגיל",
        "Exercise Library": "ספריית תרגילים",
        "Explore the body by muscle group with clear explanations for what each muscle does and where it is.": "למד את הגוף לפי קבוצות שרירים עם הסברים ברורים על מה כל שריר עושה ואיפה הוא נמצא.",
        "Fat:": "שומן:",
        "Friday": "שישי",
        "GYMRAT tools": "כלי GYMRAT",
        "Goal-based nutrition that does the math": "תזונה לפי מטרה שמחשבת בשבילך",
        "Here is a simple guide to help you choose the right ones": "הנה מדריך פשוט שיעזור לך לבחור את התרגילים המתאימים",
        "Inspect the main muscles": "בדוק את השרירים המרכזיים",
        "Keep every plan ready": "שמור כל תוכנית מוכנה",
        "Know how to train each muscle": "דע איך לאמן כל שריר",
        "MY SAVED PLANS": "התוכניות השמורות שלי",
        "Monday": "שני",
        "Morning": "בוקר",
        "Move through each muscle group from one focused dashboard and keep your progressive overload workflow clean and consistent.": "עבור בין קבוצות השרירים ממסך מרכזי אחד ושמור על עבודה מסודרת ועקבית של עומס מתקדם.",
        "My Favorites": "המועדפים שלי",
        "My Plans": "התוכניות שלי",
        "No favorites yet": "אין עדיין מועדפים",
        "Not sure which exercises to do for each muscle?": "לא בטוח אילו תרגילים לעשות לכל שריר?",
        "Notes": "הערות",
        "One month": "חודש אחד",
        "One year": "שנה אחת",
        "Performance Tracking": "מעקב ביצועים",
        "Planner Builder": "בונה מתכנן",
        "Planner actions": "פעולות מתכנן",
        "Progression": "התקדמות",
        "Progressive overload tracking": "מעקב עומס מתקדם",
        "Protein:": "חלבון:",
        "Reps": "חזרות",
        "Rest": "מנוחה",
        "Saturday": "שבת",
        "Save routines, reopen them later, and adjust your training structure when your goals change.": "שמור שגרות, פתח אותן אחר כך והתאם את מבנה האימון כשהמטרות שלך משתנות.",
        "Saved Picks": "בחירות שמורות",
        "Saved Workouts": "אימונים שמורים",
        "Sets": "סטים",
        "Sunday": "ראשון",
        "Switch to note": "החלף להערה",
        "Thursday": "חמישי",
        "Track performance over time so sets, reps, and weight changes stay easy to compare.": "עקוב אחרי ביצועים לאורך זמן כדי שיהיה קל להשוות סטים, חזרות ושינויי משקל.",
        "Track your weights and reps for every exercise and muscle group": "עקוב אחרי משקלים וחזרות לכל תרגיל וקבוצת שרירים",
        "Training Guide": "מדריך אימונים",
        "Tuesday": "שלישי",
        "Use exercise guidance to choose movements with purpose instead of guessing what to do next.": "השתמש בהכוונת תרגילים כדי לבחור תנועות עם מטרה במקום לנחש מה לעשות הלאה.",
        "User:": "משתמש:",
        "Wednesday": "רביעי",
        "Weekly Workout Routine": "שגרת אימון שבועית",
        "Weekly routine": "שגרה שבועית",
        "Weekly routine actions": "פעולות שגרה שבועית",
        "kg": "קג",
        "today": "היום",
        "Ab rollers": "גלגל בטן",
        "45 Degree calf raises": "הרמות תאומים 45 מעלות",
        "45 Degree calf raises (Toes in)": "הרמות תאומים 45 מעלות (בהונות פנימה)",
        "45 Degree calf raises (Toes out)": "הרמות תאומים 45 מעלות (בהונות החוצה)",
        "Archer pulls": "משיכות קשת",
        "Archer push ups": "שכיבות סמיכה קשת",
        "Barbell front squats": "סקוואט קדמי עם מוט",
        "Barbell squats": "סקוואט עם מוט",
        "Barbell wrist extensions": "פשיטות שורש כף יד עם מוט",
        "Bayesian curls": "כפיפות בייסיאן",
        "Behind the back wrist curls": "כפיפות שורש כף יד מאחורי הגב",
        "Belt squats": "סקוואט חגורה",
        "Bent over rows": "חתירה בהטיית גב",
        "Bosso sit ups": "כפיפות בטן על בוסו",
        "Bulgarian split squats": "סקוואט בולגרי",
        "Cable crunches": "כפיפות בטן בכבל",
        "Cable curls": "כפיפות יד קדמית בכבל",
        "Cable front raises": "הרמות קדמיות בכבל",
        "Cable lat pull overs": "פולאובר רחב גבי בכבל",
        "Cable rows": "חתירה בכבל",
        "Cable rows wide grip": "חתירה בכבל באחיזה רחבה",
        "Cable woodchoppers": "חוטבי עצים בכבל",
        "Chest supported rows": "חתירה עם תמיכת חזה",
        "Chin ups": "עליות מתח בסופינציה",
        "Close grip bench presses": "לחיצת חזה באחיזה צרה",
        "Cross body hammer curls": "פטישים אלכסוניים",
        "Cross body lat pull arounds": "משיכות רחב גבי סביב הגוף בכבל",
        "Crossing legs cable hip abductions": "הרחקות ירך בכבל ברגליים מוצלבות",
        "Dead hangs": "תלייה סטטית",
        "Decline sit ups": "כפיפות בטן בשיפוע שלילי",
        "Deficit push ups": "שכיבות סמיכה בשיפוע",
        "Diamond push ups": "שכיבות סמיכה יהלום",
        "Dips": "מקבילים",
        "Donkey calf raises": "הרמות תאומים חמור",
        "Dragon flags": "דגלי דרקון",
        "Dumbbell flys": "פרפר עם משקולות",
        "Dumbbell lateral raises": "הרחקות כתפיים עם משקולות",
        "Dumbbell wrist curls": "כפיפות שורש כף יד עם משקולות",
        "Dumbbell wrist extensions": "פשיטות שורש כף יד עם משקולות",
        "EZ bar curls": "כפיפות יד קדמית עם מוט EZ",
        "Glute bridges": "גשר ישבן",
        "Glute bridges with elevated foot": "גשר ישבן עם רגל מוגבהת",
        "Goblet squats": "גובלט סקוואט",
        "Hack squats": "האק סקוואט",
        "Hammer curls": "כפיפות פטיש",
        "Hand grippers": "גריפרים לידיים",
        "Hanging leg raises": "הרמות רגליים בתלייה",
        "Hip abductions": "הרחקות ירך",
        "Hip thrusts": "היפ טראסט",
        "Incline bench presses": "לחיצת חזה בשיפוע חיובי",
        "Incline curls": "כפיפות יד קדמית בשיפוע",
        "Incline dumbbell bench presses": "לחיצת חזה עם משקולות בשיפוע חיובי",
        "Lat pulldowns": "פולי עליון",
        "Lateral raises machine": "הרחקות כתפיים במכונה",
        "Leaning cable lateral raises": "הרחקות כתפיים בכבל בהטייה",
        "Leaning dumbbell lateral raises": "הרחקות כתפיים עם משקולת בהטייה",
        "Leg extensions": "פשיטות ברכיים",
        "Leg presses": "לחיצת רגליים",
        "Leg raises": "הרמות רגליים",
        "Lying leg curls": "כפיפות ברכיים בשכיבה",
        "Lying leg curls (Toes in)": "כפיפות ברכיים בשכיבה (בהונות פנימה)",
        "Lying leg curls (Toes out)": "כפיפות ברכיים בשכיבה (בהונות החוצה)",
        "Machine chest presses": "לחיצת חזה במכונה",
        "Machine dips": "מקבילים במכונה",
        "Machine shoulder presses": "לחיצת כתפיים במכונה",
        "Neutral grip pull ups": "מתח באחיזה ניטרלית",
        "Nordics": "נורדים",
        "One arm dumbbell rows": "חתירה עם משקולת יד אחת",
        "One arm seated lever reverse flys": "פרפר הפוך יד אחת במכונה בישיבה",
        "Overhead cable triceps extensions": "פשיטת יד אחורית בכבל מעל הראש",
        "Pec deck flys": "פרפר במכונה",
        "Pendulum squats": "פנג'לום סקוואט",
        "Plate pinches": "צביטות פלטות",
        "Preacher curls": "כפיפות כומר",
        "Reverse cable crossovers": "קרוסאובר הפוך בכבל",
        "Reverse grip curls": "כפיפות יד קדמית באחיזה הפוכה",
        "Reverse lunges": "לאנג׳ים לאחור",
        "Reverse nordics": "נורדים הפוכים",
        "Romanian deadlifts": "דדליפט רומני",
        "Seated cable flys": "פרפר בכבל בישיבה",
        "Seated calf raises": "הרמות תאומים בישיבה",
        "Seated hamstrings curls": "כפיפות המסטרינגס בישיבה",
        "Seated hamstrings curls (Toes in)": "כפיפות המסטרינגס בישיבה (בהונות פנימה)",
        "Seated hamstrings curls (Toes out)": "כפיפות המסטרינגס בישיבה (בהונות החוצה)",
        "Seated overhead triceps extensions": "פשיטת יד אחורית מעל הראש בישיבה",
        "Single leg calf raises": "הרמות תאומים ברגל אחת",
        "Single leg hip thrusts": "היפ טראסט ברגל אחת",
        "Sit ups": "כפיפות בטן",
        "Skullcrushers": "שוברי גולגולת",
        "Smith machine calf raises": "הרמות תאומים בסמית׳",
        "Smith machine curtsy lunges": "קארטסי לאנג׳ בסמית׳",
        "Smith machine incline bench presses": "לחיצת חזה בשיפוע בסמית׳",
        "Spider curls": "כפיפות ספיידר",
        "Standing calf raises": "הרמות תאומים בעמידה",
        "Standing calf raises (Toes in)": "הרמות תאומים בעמידה (בהונות פנימה)",
        "Standing calf raises (Toes out)": "הרמות תאומים בעמידה (בהונות החוצה)",
        "Standing dumbbell curls": "כפיפות יד קדמית בעמידה עם משקולות",
        "Standing hammer curls": "כפיפות פטיש בעמידה",
        "Stiff leg Romanian deadlifts": "דדליפט רומני ברגליים ישרות",
        "Triceps cable kickbacks": "קיקבק יד אחורית בכבל",
        "Triceps dumbbell kickbacks": "קיקבק יד אחורית עם משקולת",
        "Triceps pressdowns": "פשיטת יד אחורית בפולי",
        "Upright rows": "חתירה אנכית",
        "V ups": "וי-אפס",
        "Walking lunges": "לאנג׳ים בהליכה",
        "Wide grip pull ups": "מתח באחיזה רחבה",
        "Wrist rollers": "גלגול שורש כף יד",
        "GYMRAT - Main Page": "GYMRAT - דף ראשי",
        "GYMRAT - Diet": "GYMRAT - תזונה",
        "GYMRAT - Add Food": "GYMRAT - הוספת מאכל",
        "GYMRAT - Diet Setup": "GYMRAT - הגדרת תזונה",
        "GYMRAT - Diet Stats": "GYMRAT - סטטיסטיקות תזונה"
    }));

    const foodQueryAliases = new Map(Object.entries({
        "אורז": "rice",
        "אורז לבן": "white rice",
        "אורז מלא": "brown rice",
        "עוף": "chicken",
        "חזה עוף": "chicken breast",
        "ביצה": "egg",
        "ביצים": "eggs",
        "בננה": "banana",
        "תפוח": "apple",
        "לחם": "bread",
        "חלב": "milk",
        "יוגורט": "yogurt",
        "גבינה": "cheese",
        "קוטג": "cottage cheese",
        "קוטג׳": "cottage cheese",
        "טונה": "tuna",
        "פסטה": "pasta",
        "תפוח אדמה": "potato",
        "בטטה": "sweet potato",
        "שיבולת שועל": "oats",
        "שיבולת": "oats",
        "קפה": "coffee",
        "מים": "water",
        "סוכר": "sugar",
        "שמן": "oil",
        "חמאה": "butter",
        "חמאת בוטנים": "peanut butter",
        "בשר": "beef",
        "סלמון": "salmon",
        "דג": "fish",
        "אבוקדו": "avocado",
        "עגבניה": "tomato",
        "מלפפון": "cucumber",
        "חסה": "lettuce",
        "גזר": "carrot",
        "ברוקולי": "broccoli",
        "עדשים": "lentils",
        "חומוס": "chickpeas",
        "שעועית": "beans",
        "תמר": "date",
        "תפוז": "orange",
        "תות": "strawberry",
        "ענבים": "grapes"
    }));

    const foodNameRules = [
        [/^rice,\s*white\b/i, "אורז לבן"],
        [/^rice,\s*brown\b/i, "אורז מלא"],
        [/^rice\b/i, "אורז"],
        [/^egg,?\s*whole\b|^eggs,?\s*whole\b/i, "ביצה שלמה"],
        [/^egg\b|^eggs\b/i, "ביצה"],
        [/^chicken breast\b|^chicken,\s*breast\b/i, "חזה עוף"],
        [/^chicken\b/i, "עוף"],
        [/^banana\b/i, "בננה"],
        [/^apple\b/i, "תפוח"],
        [/^bread\b/i, "לחם"],
        [/^milk\b/i, "חלב"],
        [/^yogurt\b|^yoghurt\b/i, "יוגורט"],
        [/^cheese\b/i, "גבינה"],
        [/^cottage cheese\b/i, "קוטג'"],
        [/^tuna\b/i, "טונה"],
        [/^pasta\b/i, "פסטה"],
        [/^potato\b/i, "תפוח אדמה"],
        [/^sweet potato\b/i, "בטטה"],
        [/^oats\b|^oatmeal\b/i, "שיבולת שועל"],
        [/^water\b/i, "מים"],
        [/^coffee\b/i, "קפה"],
        [/^salmon\b/i, "סלמון"],
        [/^fish\b/i, "דג"],
        [/^beef\b/i, "בשר בקר"],
        [/^avocado\b/i, "אבוקדו"],
        [/^tomato\b/i, "עגבניה"],
        [/^cucumber\b/i, "מלפפון"],
        [/^lettuce\b/i, "חסה"],
        [/^carrot\b/i, "גזר"],
        [/^broccoli\b/i, "ברוקולי"],
        [/^lentils?\b/i, "עדשים"],
        [/^chickpeas?\b/i, "חומוס"],
        [/^beans?\b/i, "שעועית"]
    ];

    const originalText = new WeakMap();
    let originalTitle = "";
    let applying = false;

    function normalizeLanguage(value) {
        return value === HEBREW_LANGUAGE ? HEBREW_LANGUAGE : DEFAULT_LANGUAGE;
    }

    function getLanguage() {
        try {
            return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
        } catch (error) {
            return DEFAULT_LANGUAGE;
        }
    }

    function showLanguageLoading() {
        if (document.getElementById("languageLoadingOverlay")) return;
        const overlay = document.createElement("div");
        overlay.id = "languageLoadingOverlay";
        overlay.textContent = getLanguage() === HEBREW_LANGUAGE ? "טוען שפה" : "Loading language...";
        overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(15,23,42,.88);color:#fff;font:700 18px Arial,sans-serif;";
        document.body?.appendChild(overlay);
    }

    function setLanguage(language) {
        const next = normalizeLanguage(language);
        const current = getLanguage();
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (error) {}
        if (next !== current) {
            showLanguageLoading();
            window.setTimeout(() => window.location.reload(), 40);
            return;
        }
        syncLanguageControls(next);
        setLanguageMenuOpen(false);
    }

    function preserveSpacing(value, translated) {
        const leading = value.match(/^\s*/)?.[0] || "";
        const trailing = value.match(/\s*$/)?.[0] || "";
        return `${leading}${translated}${trailing}`;
    }

    function translatePlainText(value) {
        const text = `${value || ""}`;
        const trimmed = text.trim();
        if (!trimmed) return text;
        const exact = heText.get(trimmed);
        if (exact) return preserveSpacing(text, exact);
        const gymratTitleMatch = trimmed.match(/^GYMRAT\s+-\s+(.+)$/i);
        if (gymratTitleMatch) return preserveSpacing(text, `GYMRAT - ${translatePlainText(gymratTitleMatch[1])}`);
        const anatomyTitleMatch = trimmed.match(/^(.+)\s+Anatomy$/i);
        if (anatomyTitleMatch) return preserveSpacing(text, `${translatePlainText(anatomyTitleMatch[1])} אנטומיה`);
        const muscleGroupsTitleMatch = trimmed.match(/^(.+)\s+muscle groups$/i);
        if (muscleGroupsTitleMatch) return preserveSpacing(text, `קבוצות שרירי ${translatePlainText(muscleGroupsTitleMatch[1])}`);
        const userMatch = trimmed.match(/^User:\s*(.*)$/i);
        if (userMatch) return preserveSpacing(text, `משתמש: ${userMatch[1] || ""}`.trimEnd());
        const googleProfileMatch = trimmed.match(/^Choose one profile connected to\s+(.+)\.$/i);
        if (googleProfileMatch) return preserveSpacing(text, `בחר פרופיל אחד שמחובר אל ${googleProfileMatch[1]}.`);
        const registrationFailedMatch = trimmed.match(/^Registration failed:\s*(.*)$/i);
        if (registrationFailedMatch) return preserveSpacing(text, `ההרשמה נכשלה: ${registrationFailedMatch[1] || ""}`.trimEnd());
        const googleSetupFailedMatch = trimmed.match(/^Google sign in setup failed:\s*(.*)$/i);
        if (googleSetupFailedMatch) return preserveSpacing(text, `הגדרת ההתחברות עם Google נכשלה: ${googleSetupFailedMatch[1] || ""}`.trimEnd());
        const deleteAccountFailedMatch = trimmed.match(/^Delete account failed:\s*(.*)$/i);
        if (deleteAccountFailedMatch) return preserveSpacing(text, `מחיקת החשבון נכשלה: ${deleteAccountFailedMatch[1] || ""}`.trimEnd());
        const usernameChangeFailedMatch = trimmed.match(/^Username change failed:\s*(.*)$/i);
        if (usernameChangeFailedMatch) return preserveSpacing(text, `שינוי שם המשתמש נכשל: ${usernameChangeFailedMatch[1] || ""}`.trimEnd());
        const changeUsernameMatch = trimmed.match(/^Change username to\s+(.+)\?$/i);
        if (changeUsernameMatch) return preserveSpacing(text, `לשנות את שם המשתמש ל-${changeUsernameMatch[1]}?`);
        const saveFoodQuestionMatch = trimmed.match(/^Are you sure you want to save\s+(.+)\s+to My foods\?$/i);
        if (saveFoodQuestionMatch) return preserveSpacing(text, `האם אתה בטוח שברצונך לשמור את ${saveFoodQuestionMatch[1]} במאכלים שלי?`);
        const deleteFoodQuestionMatch = trimmed.match(/^Are you sure you want to delete\s+(.+)\s+from My foods\?$/i);
        if (deleteFoodQuestionMatch) return preserveSpacing(text, `האם אתה בטוח שברצונך למחוק את ${deleteFoodQuestionMatch[1]} מהמאכלים שלי?`);
        const deleteDayMatch = trimmed.match(/^Are you sure you want to delete the entire food log for\s+(.+)\?$/i);
        if (deleteDayMatch) return preserveSpacing(text, `האם אתה בטוח שברצונך למחוק את כל יומן המזון של ${deleteDayMatch[1]}?`);
        const addedFoodMatch = trimmed.match(/^Added\s+(.+)\s+\((.+)\)$/i);
        if (addedFoodMatch) return preserveSpacing(text, `נוסף ${addedFoodMatch[1]} (${addedFoodMatch[2]})`);
        const tableDuplicateMatch = trimmed.match(/^Error:\s+You already have a table named "(.+)"\. Please choose a different name\.$/i);
        if (tableDuplicateMatch) return preserveSpacing(text, `שגיאה: כבר יש לך טבלה בשם "${tableDuplicateMatch[1]}". בחר שם אחר.`);
        const planDuplicateMatch = trimmed.match(/^Error:\s+A plan named "(.+)" already exists\.$/i);
        if (planDuplicateMatch) return preserveSpacing(text, `שגיאה: כבר קיימת תוכנית בשם "${planDuplicateMatch[1]}".`);
        const deletePlanMatch = trimmed.match(/^Are you sure you want to delete "(.+)"\?$/i);
        if (deletePlanMatch) return preserveSpacing(text, `האם אתה בטוח שברצונך למחוק את "${deletePlanMatch[1]}"?`);
        const savedFoodMatch = trimmed.match(/^(.+) saved to My foods\.$/i);
        if (savedFoodMatch) return preserveSpacing(text, `${savedFoodMatch[1]} נשמר במאכלים שלי.`);
        const deletedFoodMatch = trimmed.match(/^(.+) deleted from My foods\.$/i);
        if (deletedFoodMatch) return preserveSpacing(text, `${deletedFoodMatch[1]} נמחק מהמאכלים שלי.`);
        const itemCountMatch = trimmed.match(/^(\d+)\s+(item|items)$/i);
        if (itemCountMatch) return preserveSpacing(text, `${itemCountMatch[1]} ${itemCountMatch[1] === "1" ? "פריט" : "פריטים"}`);
        const translateUnits = (value) => `${value || ""}`.replace(/\bkcal\b/gi, "קלוריות").replace(/(\d)\s*g\b/gi, "$1 גרם");
        const goalMatch = trimmed.match(/^goal\s+(.+)$/i);
        if (goalMatch) return preserveSpacing(text, `יעד ${translateUnits(goalMatch[1])}`);
        const recommendedMatch = trimmed.match(/^Recommended\s+(.+)$/i);
        if (recommendedMatch) return preserveSpacing(text, `מומלץ ${translateUnits(recommendedMatch[1])}`);
        const yesterdayDateMatch = trimmed.match(/^Yesterday\s*-\s*(.*)$/i);
        if (yesterdayDateMatch) return preserveSpacing(text, `אתמול - ${yesterdayDateMatch[1]}`);
        const downloadReportMatch = trimmed.match(/^Download\s+(.+)\s+as a standalone HTML report\?$/i);
        if (downloadReportMatch) return preserveSpacing(text, `להוריד את ${downloadReportMatch[1]} כדוח HTML עצמאי?`);
        const dateMatch = trimmed.match(/^Today\s*-\s*(.*)$/i);
        if (dateMatch) return preserveSpacing(text, `היום - ${dateMatch[1]}`);
        const barcodeMatch = trimmed.match(/^Barcode:\s*(.*)$/i);
        if (barcodeMatch) return preserveSpacing(text, `ברקוד: ${barcodeMatch[1]}`);
        const barcodeNameMatch = trimmed.match(/^Barcode\s+(\d+)$/i);
        if (barcodeNameMatch) return preserveSpacing(text, `ברקוד ${barcodeNameMatch[1]}`);
        const barcodeFoundMatch = trimmed.match(/^Found\s+(\d+)\s+of\s+(\d+)\s+macros\.$/i);
        if (barcodeFoundMatch) return preserveSpacing(text, `נמצאו ${barcodeFoundMatch[1]} מתוך ${barcodeFoundMatch[2]} ערכי מאקרו.`);
        return text;
    }

    function translateTextNode(node, language) {
        const current = node.nodeValue || "";
        if (originalText.has(node)) {
            const previousBase = originalText.get(node) || "";
            const expected = language === HEBREW_LANGUAGE ? translatePlainText(previousBase) : previousBase;
            if (current !== expected) originalText.set(node, current);
        } else {
            originalText.set(node, current);
        }
        const base = originalText.get(node) || "";
        const next = language === HEBREW_LANGUAGE ? translatePlainText(base) : base;
        if (node.nodeValue !== next) node.nodeValue = next;
    }

    function translateElementAttributes(element, language) {
        ["placeholder", "title", "aria-label", "value"].forEach((attr) => {
            if (!element.hasAttribute(attr)) return;
            if (attr === "value" && !["BUTTON", "INPUT"].includes(element.tagName)) return;
            const dataKey = `i18nOriginal${attr.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}`;
            const current = element.getAttribute(attr) || "";
            if (!element.dataset[dataKey]) {
                element.dataset[dataKey] = current;
            } else {
                const expected = language === HEBREW_LANGUAGE ? translatePlainText(element.dataset[dataKey] || "") : (element.dataset[dataKey] || "");
                if (current !== expected) element.dataset[dataKey] = current;
            }
            const base = element.dataset[dataKey] || "";
            const next = language === HEBREW_LANGUAGE ? translatePlainText(base) : base;
            if (element.getAttribute(attr) !== next) element.setAttribute(attr, next);
        });
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        if (!parent) return true;
        return Boolean(parent.closest("script, style, noscript, code, pre, textarea, [data-no-i18n]"));
    }

    function walk(root, language) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            if (!shouldSkipNode(root)) translateTextNode(root, language);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
        if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root, language);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
            acceptNode(node) {
                if (node.nodeType === Node.TEXT_NODE && shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
                if (node.nodeType === Node.ELEMENT_NODE && node.matches("script, style, noscript, code, pre, textarea, [data-no-i18n]")) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let node = walker.currentNode;
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
            else if (node.nodeType === Node.ELEMENT_NODE) translateElementAttributes(node, language);
            node = walker.nextNode();
        }
    }

    function syncLanguageControls(language = getLanguage()) {
        document.querySelectorAll('input[name="gymratLanguage"]').forEach((input) => {
            input.checked = input.value === language;
        });
    }

    function setLanguageMenuOpen(open) {
        const menu = document.getElementById("languageMenu");
        const button = document.getElementById("languageMenuButton");
        if (!menu || !button) return;
        menu.hidden = !open;
        button.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function bindLanguageControls() {
        const button = document.getElementById("languageMenuButton");
        if (button && button.dataset.languageBound !== "true") {
            button.dataset.languageBound = "true";
            button.setAttribute("aria-label", "Open language menu");
            button.addEventListener("click", () => {
                const menu = document.getElementById("languageMenu");
                setLanguageMenuOpen(Boolean(menu?.hidden));
            });
        }
        document.querySelectorAll('input[name="gymratLanguage"]').forEach((input) => {
            if (input.dataset.languageBound === "true") return;
            input.dataset.languageBound = "true";
            input.addEventListener("change", () => {
                if (input.checked) {
                    setLanguage(input.value);
                    setLanguageMenuOpen(false);
                }
            });
        });
        if (!document.body.dataset.languageOutsideClickBound) {
            document.body.dataset.languageOutsideClickBound = "true";
            document.addEventListener("click", (event) => {
                if (!event.target.closest(".settings-language-panel")) setLanguageMenuOpen(false);
            });
        }
        syncLanguageControls();
    }

    function applyLanguage() {
        if (!document.documentElement || !document.body) return;
        const language = getLanguage();
        applying = true;
        document.documentElement.lang = language;
        document.documentElement.dir = language === HEBREW_LANGUAGE ? "rtl" : "ltr";
        document.body.classList.toggle("lang-he", language === HEBREW_LANGUAGE);
        document.body.classList.toggle("lang-en", language !== HEBREW_LANGUAGE);
        if (!originalTitle) originalTitle = document.title || "";
        document.title = language === HEBREW_LANGUAGE ? translatePlainText(originalTitle) : originalTitle;
        walk(document.body, language);
        bindLanguageControls();
        applying = false;
    }

    function translateHebrewFoodQuery(value) {
        const text = `${value || ""}`.trim();
        if (!/[\u0590-\u05ff]/.test(text)) return text;
        const normalized = text.replace(/[־–—]/g, "-").replace(/\s+/g, " ").trim();
        if (foodQueryAliases.has(normalized)) return foodQueryAliases.get(normalized);
        let translated = normalized;
        Array.from(foodQueryAliases.keys()).sort((a, b) => b.length - a.length).forEach((hebrew) => {
            translated = translated.replace(new RegExp(hebrew.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), foodQueryAliases.get(hebrew));
        });
        return translated;
    }

    function translateFoodName(name) {
        const clean = `${name || "Food item"}`.replace(/\bNFS\b/g, "Regular").replace(/,\s*Regular\b/g, ", Regular").trim();
        if (getLanguage() !== HEBREW_LANGUAGE) return clean;
        for (const [pattern, hebrew] of foodNameRules) {
            if (pattern.test(clean)) return hebrew;
        }
        return translatePlainText(clean);
    }


    window.gymratGetLanguage = getLanguage;
    window.gymratSetLanguage = setLanguage;
    window.gymratApplyLanguage = applyLanguage;
    window.gymratTranslateText = (value) => getLanguage() === HEBREW_LANGUAGE ? translatePlainText(value) : `${value || ""}`;
    window.gymratTranslateFoodQueryToEnglish = translateHebrewFoodQuery;
    window.gymratTranslateFoodName = translateFoodName;

    if (!window.__gymratI18nDialogsWrapped) {
        window.__gymratI18nDialogsWrapped = true;
        const currentAlert = window.alert?.bind(window);
        const currentConfirm = window.confirm?.bind(window);
        if (currentAlert) window.alert = (message) => currentAlert(window.gymratTranslateText(message));
        if (currentConfirm) window.confirm = (message) => currentConfirm(window.gymratTranslateText(message));
    }

    document.addEventListener("DOMContentLoaded", () => {
        applyLanguage();
    });
})();




































