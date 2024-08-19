const express = require('express');
const routes = express.Router();
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const flatted = require('flatted');
const { JSON } = require('mysql/lib/protocol/constants/types');

//CONSULTA LOS PAISES
routes.get('/getPaises', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        conn.query('SELECT DISTINCT COD_PAIS, PAIS FROM ubicacion', (err, rows)=>{
            if(err) return res.send(err);

            res.json(rows)
        })
    })
})

//CONSULTA LOS DEPARTAMENTOS DE UN PAIS
routes.get('/getDepartamentos/:idPais', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        conn.query('SELECT DISTINCT COD_DEPARTAMENTO, DEPARTAMENTO FROM ubicacion WHERE COD_PAIS = ?', [req.params.idPais], (err, rows)=>{
            if(err) return res.send(err);
        
            res.json(rows);
        })
    })
})

//CONSULTA LAS CIUDADES DE UN DEPARTAMENTO
routes.get('/getCiudades/:idDepartamento', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        conn.query('SELECT DISTINCT COD_MUNICIPIO, MUNICIPIO FROM ubicacion WHERE COD_DEPARTAMENTO = ?', [req.params.idDepartamento], (err, rows)=>{
            if(err) return res.send(err);

            res.json(rows);
        })
    })
})

//CONSULTA LAS PUBLICACIONES ASOCIADAS A UN MODULO 
routes.get('/getPublicaciones/:departamento/:ciudad/:modulo/:precios/:palabraClave/:orden/:idUsuario', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        let sel = 'SELECT * FROM publicacion WHERE ESTADO = 1 AND VENDEDOR != COALESCE(' + req.params.idUsuario + ',"0")';
        let order = ' ORDER BY FECHA_PUBLICACION DESC';

        if(!(req.params.departamento === 'null' || req.params.departamento === '')){
            sel = sel + ' AND DEPARTAMENTO = ' + req.params.departamento;
        }

        if(!(req.params.ciudad === 'null' || req.params.ciudad === '')){
            sel = sel + ' AND CIUDAD = ' + req.params.ciudad;
        }

        if(!(req.params.modulo === 'null' || !req.params.modulo === '')){
            sel = sel + ' AND MODULO = ' + req.params.modulo;
        }

        if(!(req.params.precios === 'null' || !req.params.precios === '')){
            switch (req.params.precios) {
                case '1':
                    sel = sel + ' AND PRECIO BETWEEN 0 AND 100000';
                break;
                case '2':
                    sel = sel + ' AND PRECIO BETWEEN 100001 AND 500000';
                break;
                case '3':
                    sel = sel + ' AND PRECIO BETWEEN 500001 AND 1000000';
                break;
                case '4':
                    sel = sel + ' AND PRECIO BETWEEN 1000001 AND 1500000';
                break;
                default:
                    sel = sel + ' AND PRECIO > 1500000';
            }            
        }
           
        if(!(req.params.orden === 'null' || !req.params.orden === '')){
            switch (req.params.orden) {
                case '1':
                    order = ' ORDER BY CONVERT(PRECIO, SIGNED INTEGER) ASC';
                break;
                case '2':
                    order = ' ORDER BY CONVERT(PRECIO, SIGNED INTEGER) DESC';
                break;
                case '3':
                    order = ' ORDER BY FECHA_PUBLICACION ASC';
                break;
            }            
        }

        if(!(req.params.palabraClave === 'null' || req.params.palabraClave === '' || req.params.palabraClave === 'undefined')){
            sel = sel + " AND (DESCRIPCION LIKE '%" + req.params.palabraClave + "%' OR NOMBRE LIKE '%" + req.params.palabraClave + "%')";
        }

        conn.query(sel + order, (err, rows)=>{  
            if(err) return res.send(err);

            res.json(rows);
        })
    })
})

//CONSULTAR PUBLICACION
routes.get('/getPublicacion/:idPublicacion', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{
            let sel = 'SELECT'+ 
                    '     P.NOMBRE'+
                    '    ,P.PRECIO'+
                    '    ,P.DESCRIPCION'+
                    '    ,P.FOTOS'+
                    '    ,P.FOTO_PRI'+
                    '    ,C.MUNICIPIO AS CIUDAD'+
                    '    ,(SELECT NOMBRE FROM USUARIO WHERE ID = P.VENDEDOR) AS VENDEDOR '+
                    '    ,P.VENDEDOR AS IDVENDEDOR '+
                    'FROM publicacion P '+
                    'INNER JOIN ubicacion C ON C.COD_MUNICIPIO = P.CIUDAD '+
                    'WHERE P.ID = ?';

            conn.query(sel, [req.params.idPublicacion], (err, rows)=>{
                if(err) return res.send(err);

                res.json(rows);
            })
        }
        catch(error) {
            console.error('Error:', error);
        }
    })
})

//REGISTRA UN USUARIO
routes.post('/registrarUsuario', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        const datos = req.body;

        let sel = "INSERT INTO usuario (NOMBRE, CORREO, TELEFONO, DIRECCION, FECHA_NACIMIENTO, PAIS, DEPARTAMENTO, CIUDAD, CLAVE) VALUES ('"+datos.nombre+"','"+datos.correo+"',"+datos.telefono+",'"+datos.direccion+"','"+datos.fechaNac.slice(0, 10)+"',"+datos.pais+","+datos.departamento+","+datos.ciudad+",'"+datos.clave.trimStart()+"')";

        try{
            conn.query(sel, (err, resp)=>{
                if(err) {
                    if(err.code === "ER_DUP_ENTRY")                    
                        return res.json({ mensaje: "Ya hay un usuario registrado con este correo electronico." });
                    else
                        return res.json({ mensaje: "Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema." });
                }
                    
                res.json({ mensaje: "El usuario fue registrado correctamente." });
            })
        }
        catch(error) {
            console.error('Error:', error);
        }
    })
})

//VALIDAR INICIO DE SESION
routes.post('/login', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        const datos = req.body;

        let sel = "SELECT COUNT(*) AS CANT FROM usuario WHERE CORREO = ?";

        try{
            conn.query(sel, [datos.correo], (err, rows)=>{
                if(err) return res.send(err);

                if(rows[0].CANT == 0){
                    res.json({ mensaje: "El correo ingresado no fue encontrado, porfavor registrese primero." });
                }
                else{
                    let sel = "SELECT ID, NOMBRE FROM usuario WHERE CORREO = ? AND CLAVE = ?";

                    try{
                        conn.query(sel, [datos.correo, datos.pwd], (err, rows)=>{
                            if(err) return res.send(err);
            
                            if(rows[0] == null || rows[0] == ''){
                                res.json({ mensaje: "Contraseña incorrecta intente nuevamente." });
                            }
                            else{
                                res.json({ nombre: rows[0].NOMBRE, id: rows[0].ID});
                            }
                        })
                    }
                    catch(error) {
                        console.error('Error:', error);
                    }
                }
            })
        }
        catch(error) {
            console.error('Error:', error);
        }
    })
})

//CONSULTA EL NOMBRE DEL DEPARTAMENTO POR CORREO
routes.get('/getDepartamentoUsu/:correo', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{
            let sel = 'SELECT'+ 
            '     DEPARTAMENTO '+
            'FROM usuario '+
            'WHERE CORREO = ?';

            conn.query(sel, [req.params.correo], (err, rows)=>{
                if(err) return res.send(err);

                res.json(rows);
            })
        }
        catch(error) {
            console.error('Error:', error);
        }        
    })
})

//REGISTRAR UNA PUBLICACION
routes.post('/publicar', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send("Error: Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema.");

        const datos = req.body;

        let sel = "INSERT INTO publicacion (nombre, precio, descripcion, ciudad, modulo, fotos, foto_pri, fecha_publicacion, estado, departamento, vendedor) VALUES ('"+datos.nombre+"','"+datos.precio+"','"+datos.descripcion+"',"+datos.ciudad+","+datos.modulo+",'"+datos.fotos+"','"+datos.foto_pri+"',sysdate(),1,"+datos.departamento+",'"+datos.vendedor+"')";

        try{
            conn.query(sel, (err, resp)=>{
                if(err) return res.json("Error: Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema.");
                
                //BUSCA EL ID DE LA PUBLICACION RECIEN REGISTRADA              
                let sel = "  SELECT "+
                            "   ID "+
                            "FROM publicacion "+
                            "WHERE nombre = ? "+
                            "AND precio = ? "+
                            "AND descripcion = ? "+
                            "AND ciudad = ? "+
                            "AND modulo = ? "+
                            "AND fecha_publicacion = SUBSTRING(sysdate(),1,10) "+
                            "AND departamento = ? "+
                            "AND vendedor = ?";
               
                conn.query(sel, [datos.nombre, datos.precio, datos.descripcion, datos.ciudad, datos.modulo, datos.departamento, datos.vendedor], (err, id)=>{
                    if(err) return res.json("Error: Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema.");
                        
                    //ACTUALIZAR LOS CAMPOS foto_pri Y fotos CON LOS NUEVOS NOMBRES DE LAS FOTOS QUE SON ID + CONSECUTIVO
                    const partes = datos.fotos.split('/');
                    let fotos = '';

                    for(let i = 1; i <= partes.length; i++){
                        fotos = fotos + id[0].ID + '-' + i + '.jpg';

                        if(i < partes.length)
                            fotos = fotos + '/';
                    }

                    let sel = "UPDATE publicacion SET FOTOS = ?, FOTO_PRI = ? WHERE ID = ?";

                    conn.query(sel, [fotos, id[0].ID + '-1.jpg', id[0].ID], (err, resp)=>{
                        if(err) return res.json("Error: Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema.");
                
                        //RETORNAR EL CAMPO fotos CON LOS NUEVOS NOMBRES 
                        res.json(fotos);
                    })  
                })
            })
        }
        catch(error) {
            res.json("Error: Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema.");
        }
    })
})

//CONSULTA SI UN USUARIO YA LLEGO AL LIMITE DE LAS PUBLICACIONES QUE PUEDE REALIZAR, RETORNA TRUE SI YA ALCANZO EL LIMITE
routes.get('/validarCuentaPublicacion/:idUsuario', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{
            let sel = 'SELECT'+ 
            '     COUNT(*) AS CANT_PUBLICACIONES '+
            'FROM publicacion '+
            'WHERE VENDEDOR = ?';

            conn.query(sel, [req.params.idUsuario], (err, cantidad)=>{
                if(err) return res.send(err);

                let sel = 'SELECT'+ 
                '     TC.CANT_PUBLICACIONES '+
                'FROM tipo_cuenta TC '+
                'INNER JOIN usuario U ON U.TIPO_CUENTA = TC.ID '+
                'WHERE U.ID = ?';

                conn.query(sel, [req.params.idUsuario], (err, limite)=>{
                    if(err) return res.send(err);

                    if(cantidad[0].CANT_PUBLICACIONES < limite[0].CANT_PUBLICACIONES){
                        res.status(200).json({ res: true });
                    } else {
                        res.status(200).json({ res: false });
                    }
                })            
            })
        }
        catch(error) {
            console.error('Error:', error);
        }        
    })
})

//CONSULTA LOS MENSAJES DE UN USUARIO
routes.get('/getMensajes/:idUsuario', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);
        
        try{
            let sel = 'SELECT '+
                    '   P.VENDEDOR AS idVendedor'+
                    '  ,U.NOMBRE AS vendedor'+
                    '  ,M.ID_COMPRADOR AS idComprador'+
                    '  ,(SELECT NOMBRE FROM USUARIO WHERE ID = M.ID_COMPRADOR) AS comprador'+
                    '  ,CASE WHEN (SELECT MENSAJE_COMPRADOR FROM MENSAJE WHERE ID = MAX(M.ID)) = "" THEN '+            
                    '     (SELECT MENSAJE_VENDEDOR FROM MENSAJE WHERE ID = MAX(M.ID)) '+
                    '   ELSE '+
                    '     (SELECT MENSAJE_COMPRADOR FROM MENSAJE WHERE ID = MAX(M.ID)) '+
                    '   END ultMensaje '+
                    '  ,(SELECT leido FROM MENSAJE WHERE ID = MAX(M.ID)) as leido'+
                    '  ,P.ID as idPublicacion'+
                    '  ,CASE WHEN (SELECT MENSAJE_COMPRADOR FROM MENSAJE WHERE ID = MAX(M.ID)) = "" THEN '+   
                    '        CASE WHEN P.VENDEDOR = ? THEN '+  
                    '           1 '+ 
                    '        ELSE '+ 
                    '           0 '+ 
                    '        END  '+ 
                    '   ELSE '+  
                    '        CASE WHEN M.ID_COMPRADOR = ? THEN '+  
                    '           1 '+ 
                    '        ELSE '+ 
                    '           0 '+ 
                    '        END  '+ 
                    '   END as usrEnvio'+
                    ' FROM mensaje M'+
                    ' INNER JOIN publicacion P ON P.ID = M.ID_PUBLICACION'+
                    ' INNER JOIN usuario U ON U.ID = P.VENDEDOR'+
                    ' WHERE (P.VENDEDOR = ? OR M.ID_COMPRADOR = ?)' +
                    ' AND M.ESTADO = 1'+
                    ' GROUP BY idVendedor, idComprador, idPublicacion' +
                    ' ORDER BY M.leido ASC';

            conn.query(sel, [req.params.idUsuario, req.params.idUsuario, req.params.idUsuario, req.params.idUsuario], (err, result)=>{
                if(err) return res.send(err);   
                                   
                res.status(200).json({ res: result });                   
            })
        }
        catch(error) {
            console.error('Error:', error);
        }        
    })
})

//CONSULTA LOS MENSAJES ENTRE UN VENDEDOR Y UN COMPRADOR EN DICHA PUBLICACION
routes.get('/getMensajesPublicacion/:idPublicacion/:idVenderdor/:idComprador', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{
            let sel = ' SELECT '+
                      '    U.NOMBRE AS VENDEDOR '+
                      '   ,(SELECT NOMBRE FROM USUARIO WHERE ID = M.ID_COMPRADOR) AS COMPRADOR '+
                      '   ,M.ID_COMPRADOR AS IDCOMPRADOR '+
                      '   ,M.MENSAJE_COMPRADOR '+
                      '   ,M.MENSAJE_VENDEDOR '+
                      ' FROM publicacion P '+
                      ' INNER JOIN mensaje M ON M.ID_PUBLICACION = P.ID '+
                      ' INNER JOIN usuario U ON U.ID = P.VENDEDOR '+
                      ' WHERE P.ID = ? '+
                      ' AND M.ID_COMPRADOR = ? '+   
                      ' AND M.ESTADO = 1'+                
                      ' AND P.VENDEDOR = ?';

            conn.query(sel, [req.params.idPublicacion, req.params.idComprador, req.params.idVenderdor], (err, result)=>{
                if(err) return res.send(err);   
                                   
                res.status(200).json({ res: result });                   
            })
        }
        catch(error) {
            console.error('Error:', error);
        }        
    })
})

//CONSULTA LOS MENSAJES ENTRE UN VENDEDOR Y UN COMPRADOR EN DICHA PUBLICACION
routes.get('/setLeido/:idPublicacion/:idComprador/:idUsuario', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{
            //VALIDA QUE EL ULTIMO MENSAJE Y EL ID DEL QUE LO ENVIO, SI ES IGUAL AL USUARIO ACTIVO 
            let val = 'SELECT '+
                      '      CASE WHEN M.MENSAJE_COMPRADOR != "" THEN '+
                      '         M.ID_COMPRADOR '+
                      '      ELSE '+
                      '          P.VENDEDOR '+
                      '      END AS ID_USUARIO '+
                      '  FROM mensaje M '+
                      '  INNER JOIN publicacion P ON P.ID = M.ID_PUBLICACION '+
                      '  WHERE M.ID_COMPRADOR = ? '+
                      '  AND M.ID_PUBLICACION = ? '+
                      '  ORDER BY M.ID DESC '+
                      '  LIMIT 1';

            conn.query(val, [req.params.idComprador, req.params.idPublicacion], (err, result)=>{
                if(err) return res.send(err);      
                
                if(result[0]){
                    if(result[0].ID_USUARIO != req.params.idUsuario){
                        let sel = 'UPDATE MENSAJE SET LEIDO = 1 WHERE ID_PUBLICACION = ? AND ID_COMPRADOR = ?';
    
                        conn.query(sel, [req.params.idPublicacion, req.params.idComprador], (err, result)=>{
                            if(err) return res.send(err);                                       
                        })
                    }
                }                
                    
                res.status(200).json({ }); 
            })            
        }
        catch(error) {
            console.error('Error:', error);
        }        
    })
})

//CAMBIA EL ESTADO DE UNA CONVERSACION ENTRE DOS USUARIOS DE ACTIVA A INACTIVA
routes.get('/eliminarChatBD/:idComprador/:idPublicacion', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{    
            let sel = 'UPDATE mensaje SET ESTADO = 0 WHERE ID_PUBLICACION = ? AND ID_COMPRADOR = ?';

            conn.query(sel, [req.params.idPublicacion, req.params.idComprador], (err, result)=>{
                if(err) return res.send(err);     
                
                res.status(200).json(); 
            })      
        }
        catch(error) {
            res.status(200).json({ error }); 
        }        
    })
})

//REGISTRAR UNA PUBLICACION
routes.post('/enviarMsn', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send("Error: Ocurrio un error al realizar el registro porfavor contacte con el administrador del sistema.");

        const datos = req.body;

        let mensaje_comprador = '';
        let mensaje_vendedor = datos.mensaje;
   
        if(datos.comprador){
            mensaje_comprador = datos.mensaje;
            mensaje_vendedor = '';
        }

        let sel = "INSERT INTO mensaje (id_publicacion, id_comprador, mensaje_comprador, mensaje_vendedor, estado, leido, fecha) VALUES ('"+datos.idPublicacion+"','"+datos.idComprador+"','"+mensaje_comprador+"','"+mensaje_vendedor+"',1,0,sysdate())";

        try{
            conn.query(sel, (err, resp)=>{
                if(err) return res.json("Error: Ocurrio un error al enviar el mensaje, porfavor contacte con el administrador del sistema.");
                
                res.json("1");                  
            })
        }
        catch(error) {
            console.error('Error:', error);
            res.json("Error: Ocurrio un error al enviar el mensaje, porfavor contacte con el administrador del sistema.");
        }
    })
})

//BUSCA LA CANTIDAD DE MENSAJES ENVIADOS A UN USUARIO Y CANT DE MENSAJES QUE ESE USUARIO PUEDE RECIBIR 
routes.get('/validarEnvio/:idVendedor/:idComprador/:comprador', (req, res)=>{  
    req.getConnection(async (err, conn)=>{
        if(err) return res.send(err);

        try{
            let emisor = req.params.idVendedor;
            let receptor = req.params.idComprador;
            let queryAnd = "AND MENSAJE_VENDEDOR <> ''";

            if(req.params.comprador == 'true'){
                emisor = req.params.idComprador;
                receptor = req.params.idVendedor;
                queryAnd = "AND MENSAJE_COMPRADOR <> ''";
            }
                
            // CANTIDAD DE MENSAJES QUE PUEDE ENVIAR EL EMISOR           
            let msnEnvTotal = '';
            
            let sel = 'SELECT CANT_MENSAJES AS MSN_ENV_TOTAL '+
                    'FROM tipo_cuenta C '+
                    'INNER JOIN usuario U ON U.TIPO_CUENTA = C.ID '+
                    'WHERE U.ID = ?';

            conn.query(sel, [emisor], (err, ress)=>{
                if(err) return res.send(err);                
                        
                msnEnvTotal = ress[0].MSN_ENV_TOTAL;     
                
                // CANTIDAD DE MENSAJES QUE PUEDE RECIBIR EL RECEPTOR             
                let totMsnRecib = '';
                
                sel = 'SELECT CAN_MSN_REC AS TOT_MSN_RECIB '+
                    'FROM tipo_cuenta C '+
                    'INNER JOIN usuario U ON U.TIPO_CUENTA = C.ID '+
                    'WHERE U.ID = ?';

                conn.query(sel, [receptor], (err, ress)=>{
                    if(err) return res.send(err);                
                            
                    totMsnRecib = ress[0].TOT_MSN_RECIB;   
                    
                     // CANTIDAD DE MENSAJES ENVIADOS POR EL VENDEDOR AL COMPRADOR O VICEVERSA            
                    let msnEnviados = '';
                    
                    sel = 'SELECT COUNT(*) AS MSN_ENVIADOS '+
                        'FROM mensaje M '+
                        'INNER JOIN publicacion P ON P.ID = M.ID_PUBLICACION '+
                        'WHERE ID_COMPRADOR = ? '+
                        'AND VENDEDOR = ? '+
                        queryAnd;

                    conn.query(sel, [req.params.idComprador, req.params.idVendedor], (err, ress)=>{
                        if(err) return res.send(err);                
                                
                        msnEnviados = ress[0].MSN_ENVIADOS;    
                        res.status(200).json({ MSN_ENV_TOTAL : msnEnvTotal, TOT_MSN_RECIB : totMsnRecib, MSN_ENVIADOS : msnEnviados});
                    })                    
                })
            })
        }
        catch(error) {
            console.error('Error:', error);
        }        
    })
})

//CONSULTA LAS PUBLICACIONES ASOCIADAS A UN USUARIO
routes.get('/getMisPublicaciones/:idVendedor', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        let sel = ' SELECT * ' +
                  ' FROM publicacion ' +
                  ' WHERE ESTADO = 1 ' +
                  ' AND VENDEDOR = ? ' +
                  ' ORDER BY FECHA_PUBLICACION DESC';
      
        conn.query(sel, [req.params.idVendedor], (err, rows)=>{  
            if(err) return res.send(err);

            res.json(rows);
        })
    })
})

//CAMBIA EL ESTADO DE UNA PUBLICACION A INACTIVA
routes.get('/eliminarPublicacionBD/:idPublicacion', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{    
            let sel = 'UPDATE mensaje SET ESTADO = 0 WHERE ID_PUBLICACION = ?';

            conn.query(sel, [req.params.idPublicacion], (err, result)=>{
                if(err) return res.send(err);    
                
                let sel = 'UPDATE publicacion SET ESTADO = 0 WHERE ID = ?';

                conn.query(sel, [req.params.idPublicacion], (err, result)=>{
                    if(err) return res.send(err);      
                    
                    res.status(200).json(); 
                }) 
            })      
        }
        catch(error) {
            res.status(200).json({ error }); 
        }        
    })
})

//REGISTRA UNA CONSULTA A UNA PUBLICACION EN EL HISOTRIAL DE BUSQUEDA
routes.post('/guardarHistorial', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        const datos = req.body;

        let sel = "SELECT count(*) as cant FROM historial_busqueda WHERE id_publicacion = ? and id_comprador = ?";

        try{
            conn.query(sel, [datos.idPublicacion, datos.idComprador], (err, rows)=>{
                if(err) return res.send(err);

                if(rows[0].cant == 0){
                    let sel = "INSERT INTO historial_busqueda (id_publicacion, id_comprador, fecha_consulta) VALUES (?,?,CURRENT_DATE())";

                    conn.query(sel, [datos.idPublicacion, datos.idComprador], (err, rows)=>{
                        if(err) return res.send(err);        
                    })  
                }
                else{
                    let sel = "UPDATE historial_busqueda SET fecha_consulta = CURRENT_DATE() WHERE id_publicacion = ? AND id_comprador = ?";

                    conn.query(sel, [datos.idPublicacion, datos.idComprador], (err, rows)=>{
                        if(err) return res.send(err);        
                    })                   
                }
            })
        }
        catch(error) {
            console.error('Error:', error);
        }
    })
})

//CONSULTA LAS PUBLICACIONES VISITADAS POR UN USUARIO
routes.get('/getHistorialBusqueda/:idComprador', (req, res)=>{
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        let cant = 0;

        let sel = ' SELECT ' +
                  '   tc.cant_historial as cant ' +
                  ' FROM tipo_cuenta tc ' +
                  ' INNER JOIN usuario u ON u.tipo_cuenta = tc.id ' +
                  ' WHERE u.id = ?';
      
        conn.query(sel, [req.params.idComprador], (err, rows)=>{  
            if(err) return res.send(err);

            cant = rows[0].cant;

            let sel = ' SELECT P.* ' +
                  ' FROM publicacion P' +
                  ' INNER JOIN historial_busqueda HB ON HB.ID_PUBLICACION = P.ID' +
                  ' WHERE P.ESTADO = 1 ' +
                  ' AND HB.ID_COMPRADOR = ? ' +
                  ' ORDER BY HB.FECHA_CONSULTA DESC LIMIT ' + cant;
      
            conn.query(sel, [req.params.idComprador], (err, rows)=>{  
                if(err) return res.send(err);

                res.json(rows);
            });
        })        
    })
})

//ELIMINAR DEL HISTORIAL UNA PUBLICACION VISITADA POR UN USUARIO
routes.get('/eliminarDelHistorialBD/:idPublicacion/:idComprador', (req, res)=>{  
    req.getConnection((err, conn)=>{
        if(err) return res.send(err);

        try{         
            let sel = 'DELETE FROM historial_busqueda WHERE ID_PUBLICACION = ? AND ID_COMPRADOR = ?';

            conn.query(sel, [req.params.idPublicacion,req.params.idComprador], (err, result)=>{
                if(err) return res.send(err);      
                
                res.status(200).json(); 
            }) 
        }
        catch(error) {
            res.status(200).json({ error }); 
        }        
    })
})

//CARGA LAS IMAGENES AL SERVIDOR
const storage = multer.memoryStorage(); // Almacenamos temporalmente en la memoria
const upload = multer({ storage });

routes.post('/upload', upload.single('image'), (req, res) => {
  const nuevoNombre = req.body.nuevoNombre; // Obtenemos el nuevo nombre del cuerpo de la solicitud

  // Verificamos si se proporcionó un nuevo nombre
  if (!nuevoNombre) {
    return res.status(400).json({ error: 'El campo nuevoNombre es obligatorio.' });
  }

  const file = req.file; // El archivo se encuentra en req.file.buffer
  if (!file) {
    return res.status(400).json({ error: 'No se proporcionó ningún archivo.' });
  }

  // Puedes guardar el archivo con el nuevo nombre aquí
   fs.writeFileSync('../GWA_FrontEnd/src/assets/images/' + nuevoNombre, file.buffer);

   return res.status(200).json({ msg: 'Imagen cargada con éxito'});
});

module.exports = routes